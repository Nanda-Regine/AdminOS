import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { withRoute, badRequest, notFound, RouteError } from '@/lib/api/withRoute'
import { detectFileType, getAllowedExtensions } from '@/lib/files/parser'
import { processDocumentBuffer, toDbFileType } from '@/lib/documents/pipeline'
import { inngest } from '@/inngest/client'

export const runtime = 'nodejs'
export const maxDuration = 60 // parsing + AI for a small document fits; large ones go to Inngest

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB
/** Below this, process in the request so the user sees the summary immediately. */
const INLINE_LIMIT = 5 * 1024 * 1024

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'text/plain',
  'image/jpeg',
  'image/png',
  'image/webp',
])

// POST /api/documents/upload (multipart: file, is_reference?) — store + process.
// Was any logged-in member (field agents and client logins could upload) and
// ran processing twice; see lib/documents/pipeline.ts for the full history.
export const POST = withRoute({
  action: 'documents.write',
  rateLimit: 'api',
  audit: 'document.uploaded',
  resourceType: 'document',
}, async ({ ctx, request }) => {
  let form: FormData
  try { form = await request.formData() } catch { throw badRequest('Invalid form data') }

  const file = form.get('file')
  if (!(file instanceof File)) throw badRequest('No file provided')
  const isReference = form.get('is_reference') === 'true'

  if (file.size > MAX_FILE_SIZE) throw new RouteError(413, 'File too large. Maximum size is 10 MB.', 'too_large')
  if (!ALLOWED_MIME_TYPES.has(file.type)) throw new RouteError(415, 'File type not allowed.', 'unsupported_type')

  const fileType = detectFileType(file.name, file.type)
  const dbType = fileType ? toDbFileType(fileType) : null
  if (!fileType || !dbType) {
    throw new RouteError(415, `Unsupported file type. Supported: ${getAllowedExtensions().join(', ')}`, 'unsupported_type')
  }

  const buffer = Buffer.from(await file.arrayBuffer())

  // Private bucket; the path is always namespaced by tenant.
  const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_').slice(-120)
  const storagePath = `${ctx.tenantId}/${Date.now()}-${safeName}`
  const { error: uploadError } = await supabaseAdmin.storage
    .from('documents')
    .upload(storagePath, buffer, { contentType: file.type, upsert: false })
  if (uploadError) {
    console.error('[upload] storage error', uploadError)
    throw new RouteError(500, 'Failed to store file', 'storage_failed')
  }

  const { data: doc, error: insertErr } = await supabaseAdmin
    .from('documents')
    .insert({
      tenant_id: ctx.tenantId,
      original_filename: file.name.slice(0, 255),
      file_type: dbType,
      storage_url: storagePath,
      is_reference: isReference,
      processing_status: 'processing',
      uploaded_by: ctx.userId,
    })
    .select('id')
    .single()
  if (insertErr || !doc) {
    console.error('[upload] insert error', insertErr)
    throw new RouteError(500, 'Failed to create document record', 'insert_failed')
  }

  if (file.size < INLINE_LIMIT) {
    await processDocumentBuffer({
      docId: doc.id, tenantId: ctx.tenantId, filename: file.name, actor: ctx.userId,
      isReference, buffer, fileType, mimeType: file.type,
    })
    const { data: updated } = await supabaseAdmin
      .from('documents').select('*').eq('id', doc.id).single()
    return { id: doc.id, success: true, document: updated }
  }

  // Large file: hand to the durable Inngest job (retried, not killed with the
  // response). It re-reads the file from storage.
  await inngest.send({
    name: 'adminos/document.uploaded',
    data: { document_id: doc.id, tenant_id: ctx.tenantId, file_type: fileType, mime_type: file.type, is_reference: isReference, actor: ctx.userId },
  })
  return { id: doc.id, success: true, document: { id: doc.id, processing_status: 'processing' } }
})

// GET /api/documents/upload?path=… — a 1-hour signed URL for a stored file.
// The old check was `path.startsWith(tenantId + '/')`, which `tenant/../other/`
// passes; and anyone in the tenant could fetch any file. Now the path must
// belong to a live document row of this tenant, and the caller needs documents.read.
export const GET = withRoute({
  action: 'documents.read',
  query: z.object({ path: z.string().min(1).max(500) }),
}, async ({ ctx, query }) => {
  const path = query.path
  if (path.includes('..') || path.includes('//') || !path.startsWith(`${ctx.tenantId}/`)) throw notFound('File not found')

  const { data: doc } = await supabaseAdmin
    .from('documents').select('id').is('deleted_at', null)
    .eq('tenant_id', ctx.tenantId).eq('storage_url', path).maybeSingle()
  if (!doc) throw notFound('File not found')

  const { data, error } = await supabaseAdmin.storage.from('documents').createSignedUrl(path, 3600)
  if (error || !data) throw new RouteError(500, 'Could not generate a download link', 'sign_failed')
  return { url: data.signedUrl }
})
