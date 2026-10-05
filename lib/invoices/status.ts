/**
 * Invoice status — the one definition of "who still owes us".
 *
 * Found 2026-10-05 (Session 18): every consumer had its own idea. The debt
 * cron, the Remind button, the daily brief and the AI agents filtered
 * ['unpaid','partial']; the cashflow forecast used ['sent','overdue','partial'];
 * the health score and board pack counted only 'overdue'. But the app creates
 * invoices as 'sent', and nothing in the code ever sets 'overdue' — so live,
 * 7 of 11 past-due invoices were never chased, never in the brief, and never
 * in the forecast. Import from here instead of writing a status list.
 *
 * Overdue is computed from due_date (lib/debt/overdue.ts), never read from
 * invoices.days_overdue: that column is only recomputed by a trigger on write,
 * so it goes stale (live: 45 stored vs 158 real days).
 *
 * Outstanding is amount − amount_paid. Never trust amount_due on its own —
 * older rows carry amount_due = 0 while nothing has been paid, and `total` is
 * a vestigial column that is null on some rows.
 *
 * No imports: tests load this file directly.
 */

/** The invoice_status enum, as it exists in production. */
export const INVOICE_STATUSES = [
  'draft', 'sent', 'unpaid', 'partial', 'overdue', 'paid', 'in_collections', 'cancelled',
] as const
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number]

/**
 * Issued and not settled — money the customer owes. Excludes drafts (never
 * sent), paid, cancelled, and in_collections (handed to a third party, so
 * AdminOS must stop contacting the debtor itself).
 */
export const OPEN_INVOICE_STATUSES = ['sent', 'unpaid', 'partial', 'overdue'] as const satisfies readonly InvoiceStatus[]

/** Owed, including debts handed to collections — for totals and reports, not for chasing. */
export const OWED_INVOICE_STATUSES = [...OPEN_INVOICE_STATUSES, 'in_collections'] as const satisfies readonly InvoiceStatus[]

export function isOpen(status: string | null | undefined): boolean {
  return (OPEN_INVOICE_STATUSES as readonly string[]).includes(status ?? '')
}

export function isOwed(status: string | null | undefined): boolean {
  return (OWED_INVOICE_STATUSES as readonly string[]).includes(status ?? '')
}

/** What is still owed on one invoice: amount − amount_paid, floored at 0. */
export function outstanding(inv: { amount?: number | string | null; amount_paid?: number | string | null }): number {
  return Math.max(0, Number(inv.amount ?? 0) - Number(inv.amount_paid ?? 0))
}

/**
 * The status and amount columns implied by recording a payment total.
 * amountPaid is the cumulative total paid, not an increment. Callers reject
 * overpayment before this (the API returns a 400), so it is not clamped here.
 */
export function paymentState(amount: number, amountPaid: number): {
  status: 'paid' | 'partial' | null
  amount_paid: number
  amount_due: number
} {
  const paid = Math.max(0, amountPaid)
  const due = Math.max(0, Math.round((amount - paid) * 100) / 100)
  return {
    status: due === 0 ? 'paid' : paid > 0 ? 'partial' : null,
    amount_paid: paid,
    amount_due: due,
  }
}
