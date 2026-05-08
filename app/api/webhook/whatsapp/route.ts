import { NextRequest, NextResponse } from 'next/server'
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
import { sendWhatsApp } from '@/lib/whatsapp/send'

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

  // 2. Handle delivery/read status updates (non-blocking)
  if (statuses.length > 0) {
    void handleStatusUpdates(statuses).catch((err) =>
      console.error('[WhatsApp Webhook] Status update error:', err)
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

    // 5. Rate limit per tenant
    const { success } = await checkRateLimit('whatsapp', tenant.id)
    if (!success) continue

    // 5b. Monthly conversation limit gate
    const tenantPlan = (tenant as { plan?: string }).plan ?? 'trial'
    const overLimit  = await isOverLimit(tenant.id, tenantPlan)
    if (overLimit) {
      await sendWhatsApp({
        to:      from,
        message: `Hi! You've reached your monthly conversation limit. ` +
                 `Please contact your account administrator to upgrade your plan at adminos.co.za.`,
      }).catch(() => {})
      continue
    }

    // 5c. Increment usage counter
    void incrementUsage(tenant.id)

    // 6. Deduplicate — prevent replaying the same messageId
    const isDuplicate = await checkDuplicate(messageId)
    if (isDuplicate) continue

    // 7. Mark message as read (blue ticks to sender) — non-critical
    void markMessageRead(phoneNumberId, messageId).catch(() => undefined)

    // 8. Run workflow non-blocking — respond to Meta immediately
    const conversationHistory = await getConversationHistory(tenant.id, from)

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
    await supabaseAdmin
      .from('messages')
      .update(msgUpdate)
      .eq('whatsapp_message_id', s.id)
      .eq('direction', 'outbound')
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
        void refreshCampaignCounts(recipient.campaign_id)
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
