import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { sendAsTenant } from '@/lib/whatsapp/tenantSender'
import { withRoute, unwrap, RouteError } from '@/lib/api/withRoute'

const bodySchema = z.object({
  conversationId: z.string().uuid(),
  message: z.string().trim().min(1).max(4000),
  channel: z.enum(['whatsapp', 'email', 'dashboard']).optional(),
  /** Ignored — kept so older clients still validate. See below. */
  contactIdentifier: z.string().optional(),
})

// POST /api/conversations/reply — a person answers a customer conversation.
//
// Fixed 2026-10-05:
//  - no permission check: any login (incl. a staff-app cleaner) could message
//    the business's customers as the business. Now communications.reply.
//  - the recipient came from the request body (`contactIdentifier`), so any
//    member could WhatsApp any number on the business's account. The
//    recipient is now always the conversation's own contact.
//  - a WhatsApp failure threw a raw 500 *after* nothing was stored, and the
//    inbox cleared the reply box anyway. Now a clear 502 and nothing stored.
export const POST = withRoute({
  action: 'communications.reply',
  body: bodySchema,
  audit: 'conversation.manual_reply',
  resourceType: 'conversation',
  rateLimit: 'whatsapp',
}, async ({ ctx, body }) => {
  const conv = unwrap(await supabaseAdmin
    .from('conversations')
    .select('id, channel, contact_identifier')
    .eq('id', body.conversationId)
    .eq('tenant_id', ctx.tenantId)
    .maybeSingle(), { required: true, what: 'Conversation not found' })

  const channel = (conv.channel as string | null) ?? body.channel ?? 'dashboard'
  if (channel === 'whatsapp') {
    if (!conv.contact_identifier) throw new RouteError(400, 'This conversation has no WhatsApp number to reply to.', 'no_recipient')
    try {
      await sendAsTenant(ctx.tenantId, conv.contact_identifier as string, body.message)
    } catch (e) {
      console.error('[conversations/reply] WhatsApp send failed', e)
      throw new RouteError(502, 'WhatsApp did not accept this message. If the customer last wrote more than 24 hours ago, WhatsApp only allows approved templates.', 'send_failed')
    }
  } else if (channel === 'email') {
    throw new RouteError(501, 'Email replies are not available yet — reply on WhatsApp or by phone.', 'not_available')
  }

  const now = new Date().toISOString()
  const msg = unwrap(await supabaseAdmin.from('messages').insert({
    tenant_id: ctx.tenantId,
    conversation_id: conv.id,
    role: 'assistant',
    content: body.message,
    channel,
    from_cache: false,
  }).select('id, role, content, channel, created_at').single(), { required: true })

  unwrap(await supabaseAdmin
    .from('conversations')
    .update({ updated_at: now })
    .eq('id', conv.id)
    .eq('tenant_id', ctx.tenantId))

  return { id: conv.id, message: msg }
})
