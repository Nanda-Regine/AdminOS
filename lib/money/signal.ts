/**
 * Money intelligence — the cash-conversion-cycle brain.
 *
 * The one pure-ish service every money surface reads: AR (owed to you) with an
 * aging ladder, AP (you owe), net position, runway, and the derived signal +
 * cascade mode. Reused by the Cash Cockpit page and the signal-refresh cron
 * (this is the domain "vertical slice" contract — see ADMINOS_OS_ARCHITECTURE.md).
 */

import { supabaseAdmin } from '@/lib/supabase/admin'
import { publishSignal, financeMode, type MoneySignal } from '@/lib/signals/bus'

export interface AgingBucket {
  key: 'current' | 'd1_30' | 'd31_60' | 'd61_90' | 'd90_plus'
  label: string
  amount: number
  count: number
}

export interface OverdueInvoice {
  id: string
  contact: string
  outstanding: number
  daysOverdue: number
}

export interface MoneyIntel {
  signal: MoneySignal
  // richer aggregates for the cockpit UI
  aging: AgingBucket[]
  overdue: OverdueInvoice[]        // top overdue, worst first
  invoicedThisMonth: number
  collectedThisMonth: number
  burn30: number
  apCount: number
  arCount: number
}

const outstanding = (amount: number, paid: number) => Math.max(0, Number(amount || 0) - Number(paid || 0))

function bucketOf(days: number): AgingBucket['key'] {
  if (days <= 0) return 'current'
  if (days <= 30) return 'd1_30'
  if (days <= 60) return 'd31_60'
  if (days <= 90) return 'd61_90'
  return 'd90_plus'
}

const BUCKET_LABELS: Record<AgingBucket['key'], string> = {
  current: 'Current', d1_30: '1–30 days', d31_60: '31–60 days', d61_90: '61–90 days', d90_plus: '90+ days',
}

export async function buildMoneyIntel(tenantId: string): Promise<MoneyIntel> {
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const days30Ago = new Date(Date.now() - 30 * 86400000).toISOString()

  const [invRes, expRes] = await Promise.all([
    supabaseAdmin
      .from('invoices')
      .select('id, contact_name, amount, amount_paid, days_overdue, status, created_at, recovery_status')
      .eq('tenant_id', tenantId),
    supabaseAdmin
      .from('expenses')
      .select('amount, status, paid_at, created_at')
      .eq('tenant_id', tenantId),
  ])

  const invoices = invRes.data ?? []
  const expenses = expRes.data ?? []

  // ── AR + aging ladder ──────────────────────────────────────────────────────
  const unpaid = invoices.filter(i => i.status !== 'paid')
  const buckets: Record<AgingBucket['key'], AgingBucket> = {
    current:  { key: 'current',  label: BUCKET_LABELS.current,  amount: 0, count: 0 },
    d1_30:    { key: 'd1_30',    label: BUCKET_LABELS.d1_30,    amount: 0, count: 0 },
    d31_60:   { key: 'd31_60',   label: BUCKET_LABELS.d31_60,   amount: 0, count: 0 },
    d61_90:   { key: 'd61_90',   label: BUCKET_LABELS.d61_90,   amount: 0, count: 0 },
    d90_plus: { key: 'd90_plus', label: BUCKET_LABELS.d90_plus, amount: 0, count: 0 },
  }
  const overdue: OverdueInvoice[] = []
  let arTotal = 0, arOverdue = 0, arStuck = 0

  for (const inv of unpaid) {
    const out = outstanding(inv.amount, inv.amount_paid)
    if (out <= 0.005) continue
    const days = inv.days_overdue || 0
    const b = buckets[bucketOf(days)]
    b.amount += out
    b.count += 1
    arTotal += out
    if (days > 0) {
      arOverdue += out
      overdue.push({ id: inv.id, contact: inv.contact_name || '(unknown)', outstanding: out, daysOverdue: days })
    }
    if (days > 60) arStuck += out
  }
  overdue.sort((a, b) => b.daysOverdue - a.daysOverdue || b.outstanding - a.outstanding)

  const recoveryReview = unpaid.filter(i => i.recovery_status === 'awaiting_owner_review').length
  const invoicedThisMonth = invoices.filter(i => i.created_at >= monthStart).reduce((s, i) => s + Number(i.amount || 0), 0)
  const collectedThisMonth = invoices.filter(i => i.created_at >= monthStart).reduce((s, i) => s + Number(i.amount_paid || 0), 0)

  // ── AP + burn ──────────────────────────────────────────────────────────────
  const unpaidExp = expenses.filter(e => e.paid_at == null && e.status !== 'rejected')
  const apTotal = unpaidExp.reduce((s, e) => s + Number(e.amount || 0), 0)
  const burn30 = expenses.filter(e => e.created_at >= days30Ago).reduce((s, e) => s + Number(e.amount || 0), 0)

  const netPosition = arTotal - apTotal
  const runwayMonths = burn30 > 0 ? netPosition / burn30 : null
  const mode = financeMode({ netPosition, runwayMonths, arStuck })

  const signal: MoneySignal = {
    mode, arTotal, arOverdue, arStuck, apTotal, netPosition, runwayMonths, recoveryReview,
    health: netPosition < 0 || arStuck > 0 ? 'bad' : arOverdue > 0 ? 'watch' : 'good',
  }

  return {
    signal,
    aging: [buckets.current, buckets.d1_30, buckets.d31_60, buckets.d61_90, buckets.d90_plus],
    overdue: overdue.slice(0, 8),
    invoicedThisMonth,
    collectedThisMonth,
    burn30,
    apCount: unpaidExp.length,
    arCount: unpaid.filter(i => outstanding(i.amount, i.amount_paid) > 0.005).length,
  }
}

/** Compute + publish the money signal (used by the signal-refresh cron). */
export async function refreshMoneySignal(tenantId: string): Promise<MoneySignal> {
  const intel = await buildMoneyIntel(tenantId)
  await publishSignal('money', tenantId, intel.signal)
  return intel.signal
}
