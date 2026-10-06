/**
 * POPIA s69 — direct marketing by electronic communication.
 *
 * Source: Protection of Personal Information Act 4 of 2013, s69
 * (https://www.gov.za/documents/protection-personal-information-act).
 *   (1) Prohibited unless the data subject (a) has consented, or (b) is a
 *       customer of the responsible party, subject to (3).
 *   (3) Customer route: details obtained in the context of a sale, marketing
 *       the business's own similar goods/services, and a reasonable
 *       opportunity to object given at collection AND on every message.
 *   (4) Every message must contain the sender's identity and an address or
 *       other contact details to which the recipient may send a request that
 *       such communications cease.
 *
 * Reach broadcasts and WhatsApp sequences both go through these rules: who may
 * be messaged (`mayMarketTo`), the footer every message carries
 * (`withOptOutFooter`), and what counts as an objection (`isOptOutReply`).
 *
 * No imports: loaded directly by tests under --experimental-strip-types.
 */

export interface MarketingContact {
  phone: string | null
  contact_type: string | null
  popia_consent: boolean | null
  marketing_opt_out_at: string | null
}

/**
 * s69(1): consent, or an existing customer. A contact who has objected is
 * never messaged, whichever route they came in on. Suppliers, staff and
 * unknowns need explicit consent.
 */
export function mayMarketTo(c: MarketingContact): boolean {
  if (!c.phone?.trim()) return false
  if (c.marketing_opt_out_at) return false
  return c.popia_consent === true || c.contact_type === 'client'
}

/** "STOP", "stop.", "Unsubscribe", "opt out", "Stop please" — one short reply. */
const OPT_OUT = /^\s*(stop|unsubscribe|opt[\s-]?out|stop all|stop please|please stop)\s*[.!]*\s*$/i

export function isOptOutReply(text: string | null | undefined): boolean {
  return !!text && text.length <= 40 && OPT_OUT.test(text)
}

export const OPT_OUT_INSTRUCTION = 'Reply STOP to stop these messages.'

/** s69(4): sender identity + how to make it cease, on every message. */
export function withOptOutFooter(message: string, businessName: string | null | undefined): string {
  const body = message.trim()
  if (body.includes(OPT_OUT_INSTRUCTION)) return body
  const from = businessName?.trim() ? `— ${businessName.trim()}. ` : ''
  return `${body}\n\n${from}${OPT_OUT_INSTRUCTION}`
}

/** Keep the first contact per phone (same person stored twice is messaged once). */
export function dedupeByPhone<T extends { phone: string | null }>(rows: T[], key: (p: string) => string | null): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const r of rows) {
    const k = r.phone ? key(r.phone) : null
    if (!k || seen.has(k)) continue
    seen.add(k)
    out.push(r)
  }
  return out
}

/** `{{name}}` → the contact's first name ("there" when unknown). */
export function personalise(message: string, fullName: string | null | undefined): string {
  const first = fullName?.trim().split(/\s+/)[0] || 'there'
  return message.replace(/\{\{\s*name\s*\}\}/gi, first)
}
