import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { withRoute, unwrap } from '@/lib/api/withRoute'

const listQuery = z.object({
  status: z.enum(['open', 'auto_resolved', 'escalated', 'closed']).optional(),
  before: z.string().datetime({ offset: true }).optional(),   // updated_at cursor
  limit:  z.coerce.number().int().min(1).max(100).default(50),
})

// GET /api/conversations — the customer inbox (communications.read), newest
// activity first, cursor-paged on updated_at. Escalated conversations are the
// ones the AI handed to a person.
export const GET = withRoute({ action: 'communications.read', query: listQuery }, async ({ ctx, query }) => {
  let q = supabaseAdmin
    .from('conversations')
    .select('id, channel, contact_id, contact_name, contact_identifier, status, sentiment, intent, summary, created_at, updated_at')
    .eq('tenant_id', ctx.tenantId)
    .order('updated_at', { ascending: false })
    .limit(query.limit)
  if (query.status) q = q.eq('status', query.status)
  if (query.before) q = q.lt('updated_at', query.before)
  return unwrap(await q) ?? []
})
