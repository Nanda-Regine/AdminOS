import { createHmac, timingSafeEqual } from 'crypto'

/**
 * Verify a Twilio webhook request signature (X-Twilio-Signature).
 *
 * Twilio signs: the exact webhook URL it was configured with, followed by each
 * POST parameter (sorted by key) as key+value concatenated with no separators,
 * HMAC-SHA1'd with the account auth token and base64-encoded.
 * https://www.twilio.com/docs/usage/security#validating-requests
 *
 * Fails CLOSED: if TWILIO_AUTH_TOKEN is not configured, or the header is absent
 * or does not match, this returns false. The voice webhooks run the AI agent and
 * send WhatsApp on the tenant's behalf, so an unauthenticated request is an
 * AI-cost / toll-fraud / message-spoofing vector — reject rather than trust.
 */
export function verifyTwilioSignature(
  fullUrl: string,
  params: Record<string, string>,
  signatureHeader: string | null,
): boolean {
  const token = process.env.TWILIO_AUTH_TOKEN
  if (!token || !signatureHeader) return false

  const data = Object.keys(params).sort().reduce((acc, k) => acc + k + params[k], fullUrl)
  const expected = createHmac('sha1', token).update(Buffer.from(data, 'utf-8')).digest('base64')

  try {
    const a = Buffer.from(expected)
    const b = Buffer.from(signatureHeader)
    return a.length === b.length && timingSafeEqual(a, b)
  } catch {
    return false
  }
}

/** The public URL Twilio is configured to call — must match what Twilio signs. */
export function twilioWebhookUrl(path: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL || 'https://adminos.co.za').replace(/\/$/, '')
  return base + path
}
