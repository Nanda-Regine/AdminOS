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
    const updateData: Record<string, unknown> = { delivery_status: s.status }
    if (s.status === 'delivered') {
      updateData.delivered_at = new Date(parseInt(s.timestamp) * 1000).toISOString()
    }
    if (s.status === 'read') {
      updateData.read_at = new Date(parseInt(s.timestamp) * 1000).toISOString()
    }
    await supabaseAdmin
      .from('messages')
      .update(updateData)
      .eq('whatsapp_message_id', s.id)
      .eq('direction', 'outbound')
  }
}
