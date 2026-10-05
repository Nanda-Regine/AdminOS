import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { withRoute, unwrap, badRequest } from '@/lib/api/withRoute'
import { can } from '@/lib/auth/roleMatrix'

// GET  /api/notifications        → { items, unread }
// POST /api/notifications  {id}  → mark one read · {all:true} → mark all read
//
// Two kinds of row: addressed to one login (user_id set: "your leave was
// approved"), and tenant-level owner alerts (user_id null: overdue debts,
// bank-detail changes, payroll). Tenant-level alerts used to be returned to
// every login in the tenant — the staff app included — and any member could
// mark them all read, hiding them from the owner. They are now management-only
// (alerts.read).

function audienceFilter(userId: string, seesAlerts: boolean): string {
  return seesAlerts ? `user_id.is.null,user_id.eq.${userId}` : `user_id.eq.${userId}`
}

const listQuery = z.object({
  limit:  z.coerce.number().int().min(1).max(100).default(30),
  before: z.string().datetime({ offset: true }).optional(),   // created_at cursor
})

export const GET = withRoute({ action: 'notifications.own', query: listQuery }, async ({ ctx, query }) => {
  const filter = audienceFilter(ctx.userId, can(ctx, 'alerts.read'))

  let q = supabaseAdmin
    .from('notifications')
    .select('id, type, title, body, read, action_url, created_at')
    .eq('tenant_id', ctx.tenantId)
    .or(filter)
    .order('created_at', { ascending: false })
    .limit(query.limit)
  if (query.before) q = q.lt('created_at', query.before)

  const [items, unread] = await Promise.all([
    q,
    supabaseAdmin
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', ctx.tenantId)
      .eq('read', false)
      .or(filter),
  ])
  return { items: unwrap(items) ?? [], unread: unread.count ?? 0 }
})

const markSchema = z.object({
  id:  z.string().uuid().optional(),
  all: z.boolean().optional(),
})

export const POST = withRoute({ action: 'notifications.own', body: markSchema }, async ({ ctx, body }) => {
  if (!body.all && !body.id) throw badRequest('id or all required')

  let q = supabaseAdmin
    .from('notifications')
    .update({ read: true })
    .eq('tenant_id', ctx.tenantId)
    .or(audienceFilter(ctx.userId, can(ctx, 'alerts.read')))
  q = body.all ? q.eq('read', false) : q.eq('id', body.id!)

  unwrap(await q)
  return { ok: true }
})
