/**
 * Tiered autonomy — governs what AdminOS may do UNATTENDED (ported from JarvisOS
 * os/autonomy.ts). Pure + unit-tested; no imports so it stays laptop-testable.
 *
 *   A = auto-act              (the machine does it)
 *   B = auto-draft + wait     (the machine prepares it, the owner sends)
 *   C = surface-only          (the machine notifies, the owner acts)
 *
 * A tenant's `tenant_autonomy_config` row wins; otherwise a per-decision default
 * (below) applies; otherwise the safest tier, C.
 */

export type Tier = 'A' | 'B' | 'C'
export interface AutonomyRow { domain: string; decision_type: string; tier: Tier }

/**
 * Per-decision defaults when a tenant hasn't configured it. Chosen to PRESERVE
 * today's behaviour (recovery auto-sends gentle reminders) while defaulting
 * anything legally sensitive to surface-only.
 */
export const DECISION_DEFAULTS: Record<string, Tier> = {
  'money/invoice_reminder':      'A', // gentle reminders auto-send (current behaviour)
  'money/final_demand':          'C', // Debt Collectors Act — never auto
  'money/payment_receipt':       'A',
  'ops/low_stock_reorder_alert': 'A', // an alert, not an order — safe
  'ops/booking_reminder':        'A',
  'sales/going_cold_nudge':      'B', // draft, owner sends
  'people/approval_reminder':    'A',
  'governance/deadline_alert':   'A',
}

/** All governed decisions, for the settings UI. */
export const DECISION_CATALOGUE: { domain: string; decision_type: string; label: string; description: string }[] = [
  { domain: 'money', decision_type: 'invoice_reminder', label: 'Invoice reminders', description: 'Send courteous reminders on overdue invoices (tiers 1–3).' },
  { domain: 'money', decision_type: 'final_demand', label: 'Final demands', description: 'Harder collection language. Legally you must send these yourself.' },
  { domain: 'money', decision_type: 'payment_receipt', label: 'Payment receipts', description: 'Thank a customer automatically when they pay.' },
  { domain: 'ops', decision_type: 'low_stock_reorder_alert', label: 'Low-stock alerts', description: 'Flag products at/below reorder level.' },
  { domain: 'ops', decision_type: 'booking_reminder', label: 'Booking reminders', description: 'Remind customers of upcoming bookings to cut no-shows.' },
  { domain: 'sales', decision_type: 'going_cold_nudge', label: 'Re-engage cold leads', description: 'Reach out to contacts who have gone quiet.' },
  { domain: 'people', decision_type: 'approval_reminder', label: 'Approval reminders', description: 'Nudge you when leave/expense approvals are waiting.' },
  { domain: 'governance', decision_type: 'deadline_alert', label: 'Compliance deadline alerts', description: 'Warn you before compliance deadlines.' },
]

export function resolveTier(rows: AutonomyRow[], domain: string, decisionType: string): Tier {
  const row = rows.find(r => r.domain === domain && r.decision_type === decisionType)
  if (row) return row.tier
  return DECISION_DEFAULTS[`${domain}/${decisionType}`] ?? 'C'
}

export const canAutoAct = (t: Tier): boolean => t === 'A'
export const shouldDraftAndAwait = (t: Tier): boolean => t === 'B'
export const isSurfaceOnly = (t: Tier): boolean => t === 'C'

/** Quiet hours as minutes-since-midnight; handles overnight wrap (e.g. 21:00→06:00). */
export function isWithinQuietHours(nowMinutes: number, window?: { start: number; end: number } | null): boolean {
  if (!window) return false
  const { start, end } = window
  return start <= end ? (nowMinutes >= start && nowMinutes < end) : (nowMinutes >= start || nowMinutes < end)
}
