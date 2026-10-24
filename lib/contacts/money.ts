/**
 * What each contact has been invoiced, has paid and still owes — derived from
 * their invoices, never read from the contacts table.
 *
 * contacts.total_invoiced / total_paid / balance_owed were declared in
 * migration 002 with a default of 0 and nothing has ever written them: no
 * trigger, no route, no job. Live (2026-10-24) they were hand-seeded numbers that
 * disagreed with the invoices (a contact showing R6 440 paid had R2 777 actually
 * paid). The Contacts list, contact profile, Sales "lifetime revenue", the "going
 * cold" ranking and the AI's customer context all trusted them. Invoices are the
 * source of truth, so this derives the figures from them on every read.
 *
 * Rules:
 *   - drafts and cancelled invoices never count (never issued / voided);
 *   - invoiced = the issued amount; paid = amount_paid; owed = what is still due,
 *     including debts handed to collections (lib/invoices/status OWED_INVOICE_STATUSES);
 *   - an invoice belongs to its contact_id; only when it has none do we fall back to
 *     the phone number, and only if exactly one contact has that number.
 *
 * Pure (no server imports) so tests load it directly.
 */

import { OWED_INVOICE_STATUSES, outstanding } from '../invoices/status.ts'

export interface MoneyInvoice {
  contact_id: string | null
  contact_phone: string | null
  amount: number | string | null
  amount_paid: number | string | null
  status: string
}

export interface MoneyContact { id: string; phone: string | null }

export interface ContactMoney { invoiced: number; paid: number; owed: number }

/** Issued, non-voided invoices — the statuses that count toward a contact's history. */
export const COUNTED_INVOICE_STATUSES = ['sent', 'unpaid', 'partial', 'overdue', 'paid', 'in_collections'] as const

const COUNTED = new Set<string>(COUNTED_INVOICE_STATUSES)
const OWED = new Set<string>(OWED_INVOICE_STATUSES)

/** Last 9 digits, so +27 82 123 4501, 0821234501 and 27821234501 all match. '' when too short to trust. */
export function phoneKey(phone: string | null | undefined): string {
  const d = (phone ?? '').replace(/\D/g, '')
  return d.length >= 9 ? d.slice(-9) : ''
}

const r2 = (n: number) => Math.round(n * 100) / 100

export function summariseContactMoney(
  invoices: readonly MoneyInvoice[],
  contacts: readonly MoneyContact[],
): Map<string, ContactMoney> {
  const out = new Map<string, ContactMoney>()
  for (const c of contacts) out.set(c.id, { invoiced: 0, paid: 0, owed: 0 })

  // phone -> contact, but only when the number identifies exactly one contact.
  const byPhone = new Map<string, string | null>()
  for (const c of contacts) {
    const k = phoneKey(c.phone)
    if (!k) continue
    byPhone.set(k, byPhone.has(k) ? null : c.id)
  }

  for (const inv of invoices) {
    if (!COUNTED.has(inv.status)) continue
    let owner: string | null | undefined
    if (inv.contact_id && out.has(inv.contact_id)) owner = inv.contact_id
    else if (!inv.contact_id) owner = byPhone.get(phoneKey(inv.contact_phone)) ?? null
    if (!owner) continue
    const m = out.get(owner)!
    m.invoiced += Number(inv.amount ?? 0)
    m.paid += Number(inv.amount_paid ?? 0)
    if (OWED.has(inv.status)) m.owed += outstanding(inv)
  }

  for (const m of out.values()) { m.invoiced = r2(m.invoiced); m.paid = r2(m.paid); m.owed = r2(m.owed) }
  return out
}
