import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { withRoute, unwrap } from '@/lib/api/withRoute'

const bodySchema = z.object({
  conversationId: z.string().uuid(),
  status: z.enum(['open', 'auto_resolved', 'escalated', 'closed']),
})

// POST /api/conversations/status — resolve / escalate / close / reopen.
// Had no permission check (any login could close the business's customer
// conversations); now communications.reply, like replying.
export const POST = withRoute({
  action: 'communications.reply',
  body: bodySchema,
  resourceType: 'conversation',
}, async ({ ctx, body, audit }) => {
  const row = unwrap(await supabaseAdmin
    .from('conversations')
    .update({
      status: body.status,
      resolved_by: body.status !== 'open' ? ctx.userId : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', body.conversationId)
    .eq('tenant_id', ctx.tenantId)
    .select('id, status')
    .maybeSingle(), { required: true, what: 'Conversation not found' })

  await audit({ action: `conversation.status.${body.status}`, resourceType: 'conversation', resourceId: row.id })
  return row
})
