import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { processDocumentText, type DbFileType } from '@/lib/documents/pipeline'
import { writeAuditLog } from '@/lib/security/audit'

// POST /api/workflow/file-received — n8n hook: a file arrived elsewhere (email
// attachment, shared drive) and n8n already extracted its text.
//
// Rebuilt in Session 20. The old route was a third copy of the document
// pipeline: unmetered AI, an `invoices.insert({ tenant_id, ...modelJson })`
// that let a crafted document choose the tenant, no validation, and a plain
// `!==` secret compare. It now validates the payload, checks the tenant
// exists, and runs the shared pipeline (budgeted; invoices are extracted for
// the owner to confirm, never auto-booked).

const payloadSchema = z.object({
  tenantId:      z.string().uuid(),
  fileType:      z.enum(['pdf', 'docx', 'xlsx', 'csv', 'image', 'text']),
  extractedText: z.string().min(1).max(200_000),
  originalPath:  z.string().min(1).max(500),
  filename:      z.string().min(1).max(255),
})

function secretOk(given: string | null): boolean {
  const expected = process.env.N8N_WEBHOOK_SECRET
  if (!expected || !given) return false
  const a = Buffer.from(given), b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function POST(request: Request) {
  if (!secretOk(request.headers.get('x-n8n-secret'))) return new NextResponse('Unauthorized', { status: 401 })

  const parsed = payloadSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  const p = parsed.data

  const { data: tenant } = await supabaseAdmin.from('tenants').select('id').eq('id', p.tenantId).maybeSingle()
  if (!tenant) return NextResponse.json({ error: 'Unknown tenant' }, { status: 404 })

  const { data: doc, error } = await supabaseAdmin
    .from('documents')
    .insert({
      tenant_id: p.tenantId,
      original_filename: p.filename,
      file_type: p.fileType satisfies DbFileType,
      storage_url: p.originalPath,
      processing_status: 'processing',
    })
    .select('id')
    .single()
  if (error || !doc) {
    console.error('[file-received] insert failed', error)
    return NextResponse.json({ error: 'Could not store the document' }, { status: 500 })
  }

  await writeAuditLog({
    tenantId: p.tenantId,
    actor: 'n8n',
    action: 'document.received',
    resourceType: 'document',
    resourceId: doc.id,
    metadata: { filename: p.filename, fileType: p.fileType, source: 'n8n' },
  })

  await processDocumentText({ docId: doc.id, tenantId: p.tenantId, filename: p.filename, actor: 'n8n', text: p.extractedText })

  const { data: done } = await supabaseAdmin.from('documents').select('doc_category, processing_status').eq('id', doc.id).single()
  return NextResponse.json({ success: true, document_id: doc.id, category: done?.doc_category, status: done?.processing_status })
}
