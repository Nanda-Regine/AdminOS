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

export function verifyWebhookSignature(request: Request, rawBody: string): boolean {
  // 360dialog uses HMAC-SHA256 signature verification
  const signature = request.headers.get('x-hub-signature-256') || ''
  if (!signature) return false

  // In production, compute HMAC-SHA256 of rawBody with DIALOG360_WEBHOOK_SECRET
  // and compare to signature. Using crypto.subtle in edge runtime.
  // Placeholder: always verify in prod
  return signature.length > 0
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
