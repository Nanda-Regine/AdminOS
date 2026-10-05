import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { withRoute, unwrap } from '@/lib/api/withRoute'

const listQuery = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(100),
})

// GET /api/conversations/[id]/messages — one thread, oldest first (the last
// `limit` messages). A conversation from another tenant 404s.
export const GET = withRoute({ action: 'communications.read', query: listQuery }, async ({ ctx, params, query }) => {
  const conv = unwrap(await supabaseAdmin
    .from('conversations')
    .select('id, channel, contact_name, contact_identifier, status, sentiment, summary, updated_at')
    .eq('id', params.id)
    .eq('tenant_id', ctx.tenantId)
    .maybeSingle(), { required: true, what: 'Conversation not found' })

  const recent = unwrap(await supabaseAdmin
    .from('messages')
    .select('id, role, content, channel, created_at')
    .eq('tenant_id', ctx.tenantId)
    .eq('conversation_id', conv.id)
    .order('created_at', { ascending: false })
    .limit(query.limit)) ?? []

  return { conversation: conv, messages: [...recent].reverse() }
})
