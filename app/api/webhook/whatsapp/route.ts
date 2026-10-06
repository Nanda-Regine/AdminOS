import { NextRequest, NextResponse, after } from 'next/server'
import {
  workflowEngine,
  getTenantByWhatsAppNumber,
  getConversationHistory,
} from '@/lib/workflow/engine'
import {
  verifyWebhookSignature,
  parseMetaWebhookPayload,
  markMessageRead,
  MetaWebhookPayload,
} from '@/lib/whatsapp/send'
import { checkDuplicate } from '@/lib/cache/faqCache'
import { checkRateLimit } from '@/lib/security/rateLimit'
import { sanitizeForAI } from '@/lib/security/sanitize'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { incrementUsage, isOverLimit } from '@/lib/billing/usage'
import { sendWhatsAppMessage } from '@/lib/whatsapp/send'
import { notifyTenant } from '@/lib/notifications/notify'
import { isOptOutReply } from '@/lib/reach/consent'
import { recordOptOut } from '@/lib/reach/audience'

// GET — Meta webhook challenge verification
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const mode      = searchParams.get('hub.mode')
  const token     = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === process.env.META_WEBHOOK_VERIFY_TOKEN) {
    return new Response(challenge ?? '', { status: 200 })
  }
  return new Response('Forbidden', { status: 403 })
}

// POST — Meta inbound messages + delivery status updates
export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  let body: MetaWebhookPayload

  try {
    body = JSON.parse(rawBody) as MetaWebhookPayload
  } catch {
    return new NextResponse('Bad Request', { status: 400 })
  }

  // 1. Verify Meta HMAC-SHA256 signature
  if (!await verifyWebhookSignature(request, rawBody)) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const { phoneNumberId, messages, statuses } = parseMetaWebhookPayload(body)

  // 2. Handle delivery/read status updates after the response is sent.
  // `after()` keeps the serverless function alive until this finishes — a bare
  // un-awaited promise is frozen/killed by Vercel once the 200 goes out.
  if (statuses.length > 0) {
    after(() =>
      handleStatusUpdates(statuses).catch((err) =>
        console.error('[WhatsApp Webhook] Status update error:', err)
      )
    )
  }

  // 3. Process each inbound message
  for (const msg of messages) {
    const { from, text: rawText, mediaId, messageId, contactName } = msg

    if (!from || !messageId) continue

    const text = sanitizeForAI(rawText ?? '')

    // 4. Identify tenant by phone number ID
    const tenant = await getTenantByWhatsAppNumber(phoneNumberId)
    if (!tenant) continue

    // 5. Deduplicate first — Meta retries deliveries it thinks failed. Running
    // this after the usage increment counted every retry against the tenant's
    // monthly plan limit and re-sent the "limit reached" notice.
    const isDuplicate = await checkDuplicate(messageId)
    if (isDuplicate) continue

    // 5-stop. POPIA s69(3): an objection to marketing is honoured immediately
    // and confirmed — not handed to the AI, and never counted against the plan.
    if (isOptOutReply(rawText)) {
      await recordOptOut(tenant.id, from).catch((e) => console.error('[WhatsApp Webhook] opt-out failed:', e))
      after(() => sendWhatsAppMessage(phoneNumberId, from,
        "You won't receive marketing messages from us again. You can still message us any time.").catch(() => undefined))
      continue
    }

    // 5a. Rate limit per tenant
    const { success } = await checkRateLimit('whatsapp', tenant.id)
    if (!success) continue

    // 5b. Monthly conversation limit: the engine's checkPlanLimits step handles
    // it — a polite holding reply, and the message still lands in the inbox.
    // This gate used to drop the message entirely (the business never saw it)
    // and told the business's CUSTOMER to "upgrade your plan at adminos.co.za".
    // Here we only tell the owner, once a day.
    const tenantPlan = (tenant as { plan?: string }).plan ?? 'trial'
    if (await isOverLimit(tenant.id, tenantPlan).catch(() => false)) {
      await notifyTenant(tenant.id, {
        type: 'billing.conversation_limit',
        title: 'WhatsApp conversation limit reached',
        body: 'Customers are getting a holding reply instead of an AI answer. Their messages are in your Inbox. Upgrade your plan in Settings → Billing to restore AI replies.',
        actionUrl: '/dashboard/settings/billing',
        dedupeKey: `conv-limit-${tenant.id}`,
        dedupeHours: 24,
      }).catch(() => undefined)
    }

    // 5c. Increment usage counter
    await incrementUsage(tenant.id).catch(() => undefined)

    // 6. Mark message as read (blue ticks to sender) — non-critical
    after(() => markMessageRead(phoneNumberId, messageId).catch(() => undefined))

    // 7. Run the AI workflow after responding to Meta. This used to be an
    // un-awaited promise: Vercel freezes the function once the 200 is
    // returned, so customer replies were intermittently never generated/sent.
    const conversationHistory = await getConversationHistory(tenant.id, from)

    after(() =>
      workflowEngine
        .run('whatsapp.inbound', {
          tenant,
          from,
          text,
          mediaUrl: mediaId,
          conversationHistory,
          contactName,
          phoneNumberId,
        })
        .catch((err) => console.error('[WhatsApp Webhook] Workflow error:', err))
    )
  }

  return new NextResponse('OK', { status: 200 })
}

async function handleStatusUpdates(
  statuses: Array<{ id: string; status: string; timestamp: string; recipient_id: string }>
): Promise<void> {
  for (const s of statuses) {
    const ts = new Date(parseInt(s.timestamp) * 1000).toISOString()

    // Update conversation messages table
    const msgUpdate: Record<string, unknown> = { delivery_status: s.status }
    if (s.status === 'delivered') msgUpdate.delivered_at = ts
    if (s.status === 'read')      msgUpdate.read_at      = ts
    // messages has no `direction` column — outbound (business → customer) is
    // recorded as role='assistant', matching the chat-log shape used
    // everywhere messages get inserted (see app/api/conversations/reply,
    // lib/workflow/engine.ts). Delivery/read receipts only ever apply to
    // messages AdminOS itself sent, so this must stay scoped to 'assistant'.
    await supabaseAdmin
      .from('messages')
      .update(msgUpdate)
      .eq('whatsapp_message_id', s.id)
      .eq('role', 'assistant')
      .then(() => {}, () => {})

    // Update broadcast_recipients for Reach campaigns
    if (s.status === 'delivered' || s.status === 'read' || s.status === 'failed') {
      const recipientUpdate: Record<string, unknown> = { status: s.status }
      if (s.status === 'delivered') recipientUpdate.delivered_at = ts
      if (s.status === 'read')      recipientUpdate.read_at      = ts
      if (s.status === 'failed')    recipientUpdate.failed_at    = ts

      const { data: recipient } = await supabaseAdmin
        .from('broadcast_recipients')
        .update(recipientUpdate)
        .eq('message_id', s.id)
        .select('campaign_id')
        .maybeSingle()

      // Refresh campaign aggregate counters
      if (recipient?.campaign_id) {
        await refreshCampaignCounts(recipient.campaign_id).catch(() => undefined)
      }
    }
  }
}

async function refreshCampaignCounts(campaignId: string): Promise<void> {
  const { data } = await supabaseAdmin
    .from('broadcast_recipients')
    .select('status')
    .eq('campaign_id', campaignId)

  if (!data) return

  const delivered = data.filter(r => r.status === 'delivered' || r.status === 'read').length
  const read      = data.filter(r => r.status === 'read').length
  const failed    = data.filter(r => r.status === 'failed').length

  await supabaseAdmin
    .from('broadcast_campaigns')
    .update({ delivered_count: delivered, read_count: read, failed_count: failed })
    .eq('id', campaignId)
    .then(() => {}, () => {})
}
