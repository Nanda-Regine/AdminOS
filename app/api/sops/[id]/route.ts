import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'
import { withRoute, unwrap, notFound, conflict } from '@/lib/api/withRoute'

const updateSchema = z.object({
  title:                   z.string().trim().min(1).max(500).optional(),
  category:                z.string().max(100).optional(),
  content:                 z.record(z.string(), z.unknown()).optional(),
  status:                  z.enum(['draft','active','archived']).optional(),
  requiresAcknowledgement: z.boolean().optional(),
  applicableRoles:         z.array(z.string().max(50)).max(20).optional(),
})

const SOP_COLUMNS =
  'id, title, category, content, version, status, requires_acknowledgement, applicable_roles, created_by, published_at, created_at'

// PATCH — HR edits a policy. It was open to every member, so any staff login
// could rewrite or archive the company's disciplinary code.
//
// Versioning: a published SOP's version goes up when its wording changes, or
// when it is re-published after being archived/drafted. It used to bump on
// every PATCH that merely repeated status:'active', and not at all when the
// text of a live policy was edited.
export const PATCH = withRoute({
  action: 'handbook.write',
  body: updateSchema,
  audit: 'sop.updated',
  resourceType: 'sop_document',
}, async ({ ctx, params, body }) => {
  const current = unwrap(await supabaseAdmin
    .from('sop_documents')
    .select('id, version, status, published_at')
    .eq('id', params.id)
    .eq('tenant_id', ctx.tenantId)
    .is('deleted_at', null)
    .maybeSingle(), { required: true, what: 'SOP not found' })

  const updates: Record<string, unknown> = {}
  if (body.title !== undefined)                   updates.title = body.title
  if (body.category !== undefined)                updates.category = body.category
  if (body.content !== undefined)                 updates.content = body.content
  if (body.requiresAcknowledgement !== undefined) updates.requires_acknowledgement = body.requiresAcknowledgement
  if (body.applicableRoles !== undefined)         updates.applicable_roles = body.applicableRoles
  if (body.status !== undefined)                  updates.status = body.status

  const nextStatus = body.status ?? current.status
  const wordingChanged = body.title !== undefined || body.content !== undefined
  const republished = nextStatus === 'active' && current.status !== 'active'
  if (nextStatus === 'active' && (republished || wordingChanged)) {
    updates.published_at = new Date().toISOString()
    // First publish keeps version 1; any later publish or live edit is a new version.
    if (current.published_at) updates.version = (current.version ?? 1) + 1
  }
  if (Object.keys(updates).length === 0) return current

  const data = unwrap(await supabaseAdmin
    .from('sop_documents')
    .update(updates)
    .eq('id', params.id)
    .eq('tenant_id', ctx.tenantId)
    .eq('version', current.version)   // two editors at once: the second one retries
    .select(SOP_COLUMNS)
    .maybeSingle())
  if (!data) throw conflict('Someone else just changed this SOP — reload and try again.')
  return data
})

// POST /api/sops/[id] — the caller acknowledges they've read the current
// version. Only published SOPs can be acknowledged (it accepted drafts).
export const POST = withRoute({
  action: 'handbook.acknowledge',
  audit: 'sop.acknowledged',
  resourceType: 'sop_document',
}, async ({ ctx, params }) => {
  const sop = unwrap(await supabaseAdmin
    .from('sop_documents')
    .select('id, status')
    .eq('id', params.id)
    .eq('tenant_id', ctx.tenantId)
    .is('deleted_at', null)
    .maybeSingle())
  if (!sop || sop.status !== 'active') throw notFound('SOP not found')

  return unwrap(await supabaseAdmin
    .from('sop_acknowledgements')
    .upsert({ sop_id: params.id, user_id: ctx.userId, acknowledged_at: new Date().toISOString() }, { onConflict: 'sop_id,user_id' })
    .select('sop_id, user_id, acknowledged_at')
    .single(), { required: true })
})
