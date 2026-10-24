/**
 * Matches money-in bank lines to the customer invoices they most likely pay.
 * Pure — no imports — so tests load it directly. It only SUGGESTS; nothing is
 * marked paid until a person confirms (app/api/bank/transactions/[id]).
 *
 * Evidence, strongest first:
 *   - the invoice number (or its unique tail) appears in the bank reference —
 *     customers are asked to use it, and many do;
 *   - the amount equals what is still owed on that invoice;
 *   - the payer's name appears in the reference.
 * Amount alone is not enough when two invoices are for the same amount, so a
 * tie is reported as ambiguous rather than picked at random. One invoice is
 * only ever offered to one bank line (best score wins).
 */

export interface OpenInvoice {
  id: string
  /** Invoice number shown to the customer, e.g. INV-20260518-1009. */
  reference: string | null
  contact_name: string | null
  /** Total, and what has been paid so far. */
  amount: number
  amount_paid: number
}

export interface CreditLine {
  id: string
  description: string
  /** Positive rands received. */
  amount: number
}

export type Confidence = 'high' | 'medium'

export interface Suggestion {
  transactionId: string
  invoiceId: string
  confidence: Confidence
  score: number
  reasons: string[]
  /** True when the money received is less than what is owed (a part-payment). */
  partial: boolean
  /** Another invoice scored the same for this line — a person must choose. */
  ambiguous: boolean
}

const cents = (n: number) => Math.round(n * 100)
const alnum = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
const NAME_STOP = new Set(['mr', 'mrs', 'ms', 'miss', 'dr', 'pty', 'ltd', 'cc', 'and', 'the', 'trading', 'inc'])

function nameTokens(name: string | null): string[] {
  return (name ?? '').toLowerCase().split(/[^a-z']+/).filter((t) => t.length >= 3 && !NAME_STOP.has(t))
}

interface Scored { invoice: OpenInvoice; score: number; reasons: string[]; partial: boolean }

function scoreOne(line: CreditLine, inv: OpenInvoice): Scored | null {
  const owed = cents(inv.amount) - cents(inv.amount_paid)
  if (owed <= 0) return null
  const got = cents(line.amount)
  if (got > owed) return null // more than owed is never a clean match — overpayment needs a human
  const hay = alnum(line.description)
  const reasons: string[] = []
  let score = 0

  const ref = inv.reference ? alnum(inv.reference) : ''
  if (ref && hay.includes(ref)) { score += 70; reasons.push('Invoice number in reference') }
  else if (ref) {
    // The unique tail, e.g. the "1009" of INV-20260518-1009 — only if long enough to mean something.
    const tail = (inv.reference ?? '').split(/[^A-Za-z0-9]+/).filter(Boolean).pop() ?? ''
    if (tail.length >= 4 && /\d/.test(tail) && hay.includes(alnum(tail))) { score += 45; reasons.push('Invoice number tail in reference') }
  }

  if (got === owed) { score += 50; reasons.push('Amount matches what is owed') }
  else if (got < owed) { score += 10; reasons.push('Part-payment') }

  const tokens = nameTokens(inv.contact_name)
  if (tokens.length) {
    const hit = tokens.filter((t) => hay.includes(alnum(t))).length
    if (hit > 0) { score += Math.round(35 * (hit / tokens.length)); reasons.push('Payer name in reference') }
  }

  // A part-payment with nothing but "some money came in" is noise, not a suggestion.
  if (got < owed && !reasons.some((r) => r.includes('number') || r.includes('name'))) return null
  if (score < 55) return null
  return { invoice: inv, score, reasons, partial: got < owed }
}

export function suggestMatches(credits: readonly CreditLine[], invoices: readonly OpenInvoice[]): Suggestion[] {
  const candidates: (Scored & { line: CreditLine; ambiguous: boolean })[] = []
  for (const line of credits) {
    if (line.amount <= 0) continue
    const scored = invoices.map((inv) => scoreOne(line, inv)).filter((s): s is Scored => s !== null)
    if (!scored.length) continue
    scored.sort((a, b) => b.score - a.score)
    const ambiguous = scored.length > 1 && scored[0].score === scored[1].score
    candidates.push({ ...scored[0], line, ambiguous })
  }

  // One invoice → one bank line: highest score first, skip anything already taken.
  candidates.sort((a, b) => b.score - a.score)
  const takenInvoices = new Set<string>()
  const out: Suggestion[] = []
  for (const c of candidates) {
    if (takenInvoices.has(c.invoice.id)) continue
    takenInvoices.add(c.invoice.id)
    out.push({
      transactionId: c.line.id,
      invoiceId: c.invoice.id,
      score: c.score,
      reasons: c.reasons,
      partial: c.partial,
      ambiguous: c.ambiguous,
      // High only when the amount matches AND something names the payer/invoice, and a person
      // would not have to choose between equals.
      confidence: !c.ambiguous && c.score >= 95 && !c.partial ? 'high' : 'medium',
    })
  }
  return out
}
