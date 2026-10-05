import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'
import { can } from '@/lib/auth/roleMatrix'
import { withRoute, unwrap } from '@/lib/api/withRoute'

const createSchema = z.object({
  title:                   z.string().trim().min(1).max(500),
  category:                z.string().max(100).optional(),
  content:                 z.record(z.string(), z.unknown()).default({}),
  status:                  z.enum(['draft','active','archived']).default('draft'),
  requiresAcknowledgement: z.boolean().default(false),
  applicableRoles:         z.array(z.string().max(50)).max(20).default(['all']),
})

const listQuery = z.object({
  status:   z.enum(['draft','active','archived']).optional(),
  category: z.string().max(100).optional(),
})

const SOP_COLUMNS =
  'id, title, category, content, version, status, requires_acknowledgement, applicable_roles, created_by, published_at, created_at'

// GET — HR sees every SOP (drafts included) with who acknowledged it. Everyone
// else sees only published SOPs that apply to their role, with just their own
// acknowledgement — drafts and the whole team's ack list were open to all.
export const GET = withRoute({ action: 'handbook.read', query: listQuery }, async ({ ctx, query }) => {
  const editor = can(ctx, 'handbook.write')
  let q = supabaseAdmin
    .from('sop_documents')
    .select(`${SOP_COLUMNS}, acks:sop_acknowledgements(user_id, acknowledged_at)`)
    .eq('tenant_id', ctx.tenantId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(500)
  if (!editor)             q = q.eq('status', 'active')
  else if (query.status)   q = q.eq('status', query.status)
  if (query.category)      q = q.eq('category', query.category)

  const rows = unwrap(await q) ?? []
  if (editor) return rows
  return rows
    .filter((r) => {
      const roles = (r.applicable_roles ?? ['all']) as string[]
      return roles.includes('all') || roles.includes(ctx.role)
    })
    .map((r) => ({ ...r, acks: ((r.acks ?? []) as { user_id: string }[]).filter((a) => a.user_id === ctx.userId) }))
})

export const POST = withRoute({
  action: 'handbook.write',
  body: createSchema,
  status: 201,
  audit: 'sop.created',
  resourceType: 'sop_document',
}, async ({ ctx, body }) => {
  return unwrap(await supabaseAdmin
    .from('sop_documents')
    .insert({
      tenant_id:                ctx.tenantId,
      title:                    body.title,
      category:                 body.category ?? null,
      content:                  body.content,
      status:                   body.status,
      requires_acknowledgement: body.requiresAcknowledgement,
      applicable_roles:         body.applicableRoles,
      created_by:               ctx.userId,
      published_at:             body.status === 'active' ? new Date().toISOString() : null,
    })
    .select(SOP_COLUMNS)
    .single(), { required: true })
})
