/**
 * Meta WhatsApp Business API v19.0 — replaces 360dialog
 * All outbound messaging and webhook verification lives here.
 */

export type MetaTemplateComponent = {
  type: 'header' | 'body' | 'button'
  parameters: Array<{ type: 'text'; text: string }>
}

const META_API_BASE = 'https://graph.facebook.com/v19.0'

function getAccessToken(): string {
  const token = process.env.META_WHATSAPP_ACCESS_TOKEN
  if (!token) throw new Error('[Meta WhatsApp] META_WHATSAPP_ACCESS_TOKEN not set')
  return token
}

async function metaPost(url: string, body: unknown): Promise<unknown> {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getAccessToken()}`,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: res.statusText } }))
    const errObj = err as { error?: { code?: number; message?: string } }
    throw new Error(
      `[Meta WhatsApp] API error ${res.status}: ${errObj.error?.message ?? 'Unknown error'} (code ${errObj.error?.code ?? 'N/A'})`
    )
  }

  return res.json()
}

export async function sendWhatsAppMessage(
  phoneNumberId: string,
  to: string,
  body: string
): Promise<{ messageId: string }> {
  const data = await metaPost(`${META_API_BASE}/${phoneNumberId}/messages`, {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'text',
    text: { preview_url: false, body },
  }) as { messages?: Array<{ id: string }> }

  return { messageId: data.messages?.[0]?.id ?? '' }
}

export async function sendWhatsAppTemplate(
  phoneNumberId: string,
  to: string,
  templateName: string,
  languageCode: 'en_ZA' | 'af_ZA' | 'zu_ZA' | 'xh_ZA' | string,
  components: MetaTemplateComponent[]
): Promise<{ messageId: string }> {
  const data = await metaPost(`${META_API_BASE}/${phoneNumberId}/messages`, {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode },
      components,
    },
  }) as { messages?: Array<{ id: string }> }

  return { messageId: data.messages?.[0]?.id ?? '' }
}

export async function markMessageRead(
  phoneNumberId: string,
  messageId: string
): Promise<void> {
  await metaPost(`${META_API_BASE}/${phoneNumberId}/messages`, {
    messaging_product: 'whatsapp',
    status: 'read',
    message_id: messageId,
  })
}

/** Kept for backward compat — wraps sendWhatsAppMessage with env phone number ID */
export async function sendWhatsApp({
  to,
  message,
}: {
  to: string
  message: string
}): Promise<void> {
  const phoneNumberId = process.env.META_PHONE_NUMBER_ID!
  await sendWhatsAppMessage(phoneNumberId, to, message)
}

/** HMAC-SHA256 verification using Web Crypto API (Edge-compatible) */
export async function verifyWebhookSignature(
  request: Request,
  rawBody: string
): Promise<boolean> {
  const signature = request.headers.get('x-hub-signature-256') || ''
  if (!signature) return false

  const secret = process.env.META_WEBHOOK_SECRET
  if (!secret) {
    console.error('[Meta Webhook] META_WEBHOOK_SECRET not set — rejecting all webhooks')
    return false
  }

  try {
    const encoder = new TextEncoder()
    const keyData = encoder.encode(secret)
    const messageData = encoder.encode(rawBody)

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )

    const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, messageData)
    const computed =
      'sha256=' +
      Array.from(new Uint8Array(signatureBuffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')

    if (computed.length !== signature.length) return false
    let mismatch = 0
    for (let i = 0; i < computed.length; i++) {
      mismatch |= computed.charCodeAt(i) ^ signature.charCodeAt(i)
    }
    return mismatch === 0
  } catch (err) {
    console.error('[Meta Webhook] Signature verification error:', err)
    return false
  }
}

// ── Meta webhook payload types ──────────────────────────────────────────────

export type MetaMessage = {
  from: string
  id: string
  timestamp: string
  type: 'text' | 'audio' | 'image' | 'document' | 'interactive' | 'button'
  text?: { body: string }
  audio?: { id: string; mime_type: string }
  image?: { id: string; mime_type: string }
  document?: { id: string; mime_type: string; filename?: string }
  interactive?: {
    type: string
    button_reply?: { id: string; title: string }
    list_reply?: { id: string; title: string }
  }
}

export type MetaStatus = {
  id: string
  status: 'sent' | 'delivered' | 'read' | 'failed'
  timestamp: string
  recipient_id: string
  errors?: Array<{ code: number; title: string }>
}

export type MetaWebhookPayload = {
  object: 'whatsapp_business_account'
  entry: Array<{
    id: string
    changes: Array<{
      field: 'messages'
      value: {
        messaging_product: 'whatsapp'
        metadata: { display_phone_number: string; phone_number_id: string }
        contacts?: Array<{ profile: { name: string }; wa_id: string }>
        messages?: MetaMessage[]
        statuses?: MetaStatus[]
      }
    }>
  }>
}

/** Parse Meta webhook payload — returns normalized message data */
export function parseMetaWebhookPayload(body: MetaWebhookPayload): {
  phoneNumberId: string
  messages: Array<{ from: string; text: string; mediaId: string | null; messageId: string; contactName: string }>
  statuses: MetaStatus[]
} {
  const messages: Array<{ from: string; text: string; mediaId: string | null; messageId: string; contactName: string }> = []
  const statuses: MetaStatus[] = []
  let phoneNumberId = ''

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== 'messages') continue
      const val = change.value
      phoneNumberId = val.metadata.phone_number_id

      const contactMap: Record<string, string> = {}
      for (const c of val.contacts ?? []) {
        contactMap[c.wa_id] = c.profile.name
      }

      for (const msg of val.messages ?? []) {
        messages.push({
          from: msg.from,
          text:
            msg.text?.body ||
            msg.interactive?.button_reply?.title ||
            msg.interactive?.list_reply?.title ||
            '',
          mediaId:
            msg.audio?.id || msg.image?.id || msg.document?.id || null,
          messageId: msg.id,
          contactName: contactMap[msg.from] ?? '',
        })
      }

      statuses.push(...(val.statuses ?? []))
    }
  }

  return { phoneNumberId, messages, statuses }
}

/** Legacy alias — used by existing workflow engine */
export function parseWhatsAppPayload(body: Record<string, unknown>): {
  from: string
  text: string
  mediaUrl: string | null
  messageId: string
  wabaId: string
} {
  try {
    const parsed = parseMetaWebhookPayload(body as unknown as MetaWebhookPayload)
    const first = parsed.messages[0]
    return {
      from: first?.from ?? '',
      text: first?.text ?? '',
      mediaUrl: first?.mediaId ?? null,
      messageId: first?.messageId ?? '',
      wabaId: (body as { entry?: Array<{ id: string }> }).entry?.[0]?.id ?? '',
    }
  } catch {
    return { from: '', text: '', mediaUrl: null, messageId: '', wabaId: '' }
  }
}
