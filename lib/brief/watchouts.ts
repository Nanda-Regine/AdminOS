/**
 * "Three things that will cost you money this week" — the structured half of
 * the morning brief. Pure (type-only imports) so tests load it directly.
 *
 * Every number here is computed from the saved forecast and the open invoices,
 * never written by the AI: Langa narrates around these, it doesn't invent
 * them. Each item carries its own link, so the brief is a to-do list, not prose.
 *
 * Honesty rules: the forecast's opening balance is 0, so its "lowest point" is
 * how far money OUT is expected to outrun money IN — not a bank balance, and it
 * is worded that way. Anything derived from a forecast or a payment habit says
 * it's an estimate.
 */

import type { Behaviour } from '../invoices/paymentBehaviour.ts'

export type WatchKind = 'cash_gap' | 'payroll' | 'tax' | 'late_payer' | 'overdue'

export interface Watchout {
  id: string
  kind: WatchKind
  title: string
  detail: string
  /** Rands at stake — the ranking key. */
  amount: number
  href: string
  actionLabel: string
}

export interface WatchForecast {
  lowestPoint: number
  lowestPointDate: string
  outflows: { date: string; amount: number; probability: number; source: string; label: string }[]
}

export interface WatchInvoice {
  id: string
  contact: string
  outstanding: number
  dueDate: string | null
  /** The customer's own payment habit, when they have enough history. */
  habit: Behaviour | null
}

export interface WatchInputs {
  /** SAST date, YYYY-MM-DD. */
  today: string
  forecast: WatchForecast | null
  openInvoices: readonly WatchInvoice[]
}

const DAY = 86_400_000
const ts = (d: string) => Date.parse(`${d}T00:00:00Z`)
const daysFrom = (from: string, to: string) => Math.round((ts(to) - ts(from)) / DAY)
const rand = (n: number) => `R${Math.round(n).toLocaleString('en-ZA')}`
const day = (iso: string) => new Date(ts(iso)).toLocaleDateString('en-ZA', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' })

export function buildWatchouts(input: WatchInputs, max = 3): Watchout[] {
  const { today, forecast, openInvoices } = input
  const out: Watchout[] = []

  if (forecast && forecast.lowestPoint < 0) {
    const inDays = daysFrom(today, forecast.lowestPointDate)
    if (inDays >= 0 && inDays <= 30) {
      out.push({
        id: 'cash_gap',
        kind: 'cash_gap',
        title: `Money out is set to outrun money in by ${rand(-forecast.lowestPoint)}`,
        detail: `Estimated worst point is around ${day(forecast.lowestPointDate)}, from expected payments, expenses, payroll and tax.`,
        amount: -forecast.lowestPoint,
        href: '/dashboard/cashflow',
        actionLabel: 'See the forecast',
      })
    }
  }

  if (forecast) {
    const soon = forecast.outflows.filter((o) => {
      const d = daysFrom(today, o.date)
      return d >= 0 && d <= 7 && (o.source === 'payroll' || o.source === 'tax')
    })
    for (const source of ['payroll', 'tax'] as const) {
      const items = soon.filter((o) => o.source === source)
      if (!items.length) continue
      const amount = items.reduce((s, o) => s + o.amount * o.probability, 0)
      const first = items.map((o) => o.date).sort()[0]
      out.push({
        id: source,
        kind: source,
        title: source === 'payroll' ? `Payroll of ${rand(amount)} goes out ${day(first)}` : `Tax to SARS of ${rand(amount)} is due ${day(first)}`,
        detail: source === 'payroll' ? 'Based on your latest payroll run.' : 'EMP201 (PAYE, UIF, SDL) sized on your latest payroll run.',
        amount,
        href: source === 'payroll' ? '/dashboard/payroll' : '/dashboard/compliance',
        actionLabel: source === 'payroll' ? 'Open payroll' : 'Open compliance',
      })
    }
  }

  // Due in the next week, from a customer who usually pays late: that money is likely to slip.
  const slippers = openInvoices
    .filter((i) => {
      if (!i.dueDate || !i.habit) return false
      const d = daysFrom(today, i.dueDate)
      return d >= 0 && d <= 7 && i.habit.medianDaysLate >= 3 && i.habit.lateRate >= 0.6
    })
    .sort((a, b) => b.outstanding - a.outstanding)
    .slice(0, max)
  for (const i of slippers) {
    out.push({
      id: `late_payer:${i.id}`,
      kind: 'late_payer',
      title: `${rand(i.outstanding)} from ${i.contact} may arrive late`,
      detail: `Due ${day(i.dueDate!)}, but they usually pay about ${i.habit!.medianDaysLate} days late (${i.habit!.n} invoices). A friendly nudge now helps.`,
      amount: i.outstanding,
      href: '/dashboard/invoices',
      actionLabel: 'Send a reminder',
    })
  }

  const overdue = openInvoices.filter((i) => i.dueDate && i.dueDate < today && i.outstanding > 0)
  if (overdue.length) {
    const total = overdue.reduce((s, i) => s + i.outstanding, 0)
    const biggest = [...overdue].sort((a, b) => b.outstanding - a.outstanding)[0]
    out.push({
      id: 'overdue',
      kind: 'overdue',
      title: `${overdue.length} overdue invoice${overdue.length === 1 ? '' : 's'} — ${rand(total)} to collect`,
      detail: `Largest: ${biggest.contact}, ${rand(biggest.outstanding)}, ${daysFrom(biggest.dueDate!, today)} days overdue.`,
      amount: total,
      href: '/dashboard/invoices',
      actionLabel: 'Chase payments',
    })
  }

  return out.sort((a, b) => b.amount - a.amount).slice(0, max)
}
