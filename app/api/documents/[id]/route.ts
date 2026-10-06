import { supabaseAdmin } from '@/lib/supabase/admin'
import { withRoute, unwrap, notFound } from '@/lib/api/withRoute'
import { softDelete } from '@/lib/db/softDelete'

// GET /api/documents/[id] — one live document of this business.
// Was any logged-in member, through the session client; now documents.read.
export const GET = withRoute({
  action: 'documents.read',
}, async ({ ctx, params }) => {
  return unwrap(await supabaseAdmin
    .from('documents')
    .select('*')
    .eq('id', params.id)
    .eq('tenant_id', ctx.tenantId)
    .is('deleted_at', null)
    .maybeSingle(), { required: true, what: 'Document not found' })
})

// DELETE /api/documents/[id] — soft delete (Rule #3).
// This used to hard-delete the row AND remove the stored file from two
// buckets (one of which, 'tenant-documents', doesn't exist), with no role
// check: any staff member could permanently destroy any business document.
// The file is kept so the document can be restored; storage is only purged
// by a deliberate retention process, never by a click.
export const DELETE = withRoute({
  action: 'documents.write',
  audit: 'document.deleted',
  resourceType: 'document',
}, async ({ ctx, params }) => {
  if (!(await softDelete(supabaseAdmin, 'documents', { id: params.id, tenantId: ctx.tenantId }))) throw notFound('Document not found')
  return { id: params.id, deleted: true }
})
