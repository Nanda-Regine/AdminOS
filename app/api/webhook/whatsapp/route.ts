import { NextResponse } from 'next/server'
import { workflowEngine, getTenantByWhatsAppNumber, getConversationHistory } from '@/lib/workflow/engine'
import { parseWhatsAppPayload, verifyWebhookSignature } from '@/lib/whatsapp/send'
import { checkDuplicate } from '@/lib/cache/faqCache'
import { checkRateLimit } from '@/lib/security/rateLimit'
import { sanitizeForAI } from '@/lib/security/sanitize'

export async function POST(request: Request) {
  const rawBody = await request.text()
  let body: Record<string, unknown>

  try {
    body = JSON.parse(rawBody)
  } catch {
    return new NextResponse('Bad Request', { status: 400 })
  }

  // 1. Verify 360dialog signature (HMAC-SHA256)
  if (!await verifyWebhookSignature(request, rawBody)) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  // 2. Extract message and sanitize user-controlled text before any AI processing
  const { from, text: rawText, mediaUrl, messageId, wabaId } = parseWhatsAppPayload(body)
  const text = sanitizeForAI(rawText ?? '')

  if (!from || !messageId) {
    return new NextResponse('OK', { status: 200 })
  }

  // 3. Identify tenant
  const tenant = await getTenantByWhatsAppNumber(wabaId)
  if (!tenant) {
    return new NextResponse('OK', { status: 200 })
  }

  // 4. Rate limit
  const { success } = await checkRateLimit('whatsapp', tenant.id)
  if (!success) {
    return new NextResponse('Too Many Requests', { status: 429 })
  }

  // 5. Deduplicate
  const isDuplicate = await checkDuplicate(messageId)
  if (isDuplicate) {
    return new NextResponse('OK', { status: 200 })
  }

  // 6. Run workflow (non-blocking — respond to 360dialog immediately)
  const conversationHistory = await getConversationHistory(tenant.id, from)

  workflowEngine
    .run('whatsapp.inbound', {
      tenant,
      from,
      text,
      mediaUrl,
      conversationHistory,
    })
    .catch((err) => console.error('[WhatsApp Webhook] Workflow error:', err))

  return new NextResponse('OK', { status: 200 })
}

// 360dialog requires a GET for webhook verification
export async function GET(request: Request) {
  const url = new URL(request.url)
  const challenge = url.searchParams.get('hub.challenge')
  if (challenge) {
    return new NextResponse(challenge, { status: 200 })
  }
  return new NextResponse('OK', { status: 200 })
}
