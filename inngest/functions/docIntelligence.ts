import { inngest } from '@/inngest/client'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { processDocumentBuffer } from '@/lib/documents/pipeline'
import type { SupportedFileType } from '@/lib/files/parser'

// Large-file document processing (≥5 MB). Small uploads are processed inline by
// /api/documents/upload; this job used to run on EVERY upload as a second,
// diverging pipeline (double AI spend, racing writes, and it turned any
// "invoice" into a receivable). It now runs the shared pipeline, durably.
export const docIntelligencePipeline = inngest.createFunction(
  { id: 'doc-intelligence-pipeline', retries: 2, timeouts: { finish: '5m' }, triggers: [{ event: 'adminos/document.uploaded' }] },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async ({ event, step }: any) => {
    const { document_id, tenant_id, file_type, mime_type, is_reference, actor } = event.data as {
      document_id: string
      tenant_id: string
      file_type: SupportedFileType
      mime_type: string
      is_reference: boolean
      actor?: string
    }

    // Download + parse + AI in one step: the file buffer can't be memoised
    // between steps, and the pipeline writes its own outcome to the row
    // (done / failed with a reason), so a retry simply reprocesses.
    return step.run('process-document', async () => {
      const { data: doc } = await supabaseAdmin
        .from('documents')
        .select('storage_url, original_filename, processing_status').is('deleted_at', null)
        .eq('id', document_id)
        .eq('tenant_id', tenant_id)
        .maybeSingle()
      if (!doc) return { status: 'skipped', reason: 'document_missing' }
      if (doc.processing_status === 'done') return { status: 'skipped', reason: 'already_done' }

      const { data: file, error } = await supabaseAdmin.storage.from('documents').download(doc.storage_url)
      if (error || !file) {
        await supabaseAdmin.from('documents').update({ processing_status: 'failed', ai_summary: 'The stored file could not be read. Please upload it again.' }).eq('id', document_id)
        return { status: 'failed', reason: 'download_failed' }
      }

      await processDocumentBuffer({
        docId: document_id,
        tenantId: tenant_id,
        filename: doc.original_filename ?? 'document',
        actor: actor ?? 'system',
        isReference: is_reference,
        buffer: Buffer.from(await file.arrayBuffer()),
        fileType: file_type,
        mimeType: mime_type || file.type,
      })
      return { status: 'processed' }
    })
  }
)
