interface SendWhatsAppParams {
  to: string
  message: string
  apiKey?: string
}

export async function sendWhatsApp({ to, message, apiKey }: SendWhatsAppParams): Promise<void> {
  const key = apiKey || process.env.DIALOG360_API_KEY!

  const response = await fetch('https://waba.360dialog.io/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'D360-API-KEY': key,
    },
    body: JSON.stringify({
      to,
      type: 'text',
      text: { body: message },
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`[360dialog] Failed to send message: ${error}`)
  }
}

export async function verifyWebhookSignature(
  request: Request,
  rawBody: string
): Promise<boolean> {
  const signature = request.headers.get('x-hub-signature-256') || ''
  if (!signature) return false

  const secret = process.env.DIALOG360_WEBHOOK_SECRET
  if (!secret) {
    console.error('[WhatsApp] DIALOG360_WEBHOOK_SECRET not set — rejecting all webhooks')
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
    const computed = 'sha256=' + Array.from(new Uint8Array(signatureBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')

    // Constant-time comparison to prevent timing attacks
    if (computed.length !== signature.length) return false
    let mismatch = 0
    for (let i = 0; i < computed.length; i++) {
      mismatch |= computed.charCodeAt(i) ^ signature.charCodeAt(i)
    }
    return mismatch === 0
  } catch (err) {
    console.error('[WhatsApp] Signature verification error:', err)
    return false
  }
}

export function parseWhatsAppPayload(body: Record<string, unknown>): {
  from: string
  text: string
  mediaUrl: string | null
  messageId: string
  wabaId: string
} {
  // 360dialog webhook payload structure
  const messages = (body.messages as Record<string, unknown>[]) || []
  const msg = messages[0] || {}
  const textObj = msg.text as Record<string, string> | undefined
  const imageObj = msg.image as Record<string, string> | undefined
  const documentObj = msg.document as Record<string, string> | undefined

  return {
    from: (msg.from as string) || '',
    text: textObj?.body || '',
    mediaUrl: imageObj?.id || documentObj?.id || null,
    messageId: (msg.id as string) || '',
    wabaId: (body.waba_id as string) || '',
  }
}
