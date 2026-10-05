import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'
import { withRoute, unwrap, notFound } from '@/lib/api/withRoute'
import { isTenantStaff } from '@/lib/people/ownStaff'

// https only: a `javascript:` or `data:` URL stored here renders as a live link
// on the staff detail page.
const httpsUrl = z.string().url().max(2000).refine((u) => u.startsWith('https://'), 'Must be an https:// link')

const uploadSchema = z.object({
  title:      z.string().trim().min(1).max(300),
  file_url:   httpsUrl,
  file_type:  z.string().max(50).optional(),
  expires_at: z.string().datetime({ offset: true }).optional(),
})

const COLUMNS = 'id, tenant_id, staff_id, title, file_url, file_type, expires_at, created_at'

// HR-sensitive (IDs, contracts, certifications) — manage_staff, not
// manage_documents: the 'staff' role holds manage_documents by default.
export const GET = withRoute({ action: 'staff.read' }, async ({ ctx, params }) => {
  if (!(await isTenantStaff(ctx.tenantId, params.id))) throw notFound('Staff member not found')
  return unwrap(await supabaseAdmin
    .from('staff_documents')
    .select(COLUMNS)
    .eq('tenant_id', ctx.tenantId)
    .eq('staff_id', params.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })) ?? []
})

export const POST = withRoute({
  action: 'staff.write',
  body: uploadSchema,
  status: 201,
  audit: 'staff.document_added',
  resourceType: 'staff_document',
}, async ({ ctx, params, body }) => {
  if (!(await isTenantStaff(ctx.tenantId, params.id))) throw notFound('Staff member not found')
  return unwrap(await supabaseAdmin
    .from('staff_documents')
    .insert({
      tenant_id:  ctx.tenantId,
      staff_id:   params.id,
      title:      body.title,
      file_url:   body.file_url,
      file_type:  body.file_type  ?? null,
      expires_at: body.expires_at ?? null,
    })
    .select(COLUMNS)
    .single(), { required: true })
})
