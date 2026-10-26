/**
 * The scheduled jobs that carry a heartbeat, and how long each may be silent
 * before it counts as late. Pure (no imports) so tests load it directly.
 *
 * maxGapHours is the longest normal gap between two runs PLUS slack: the
 * Mon–Fri brief runs Friday then Monday (72 h apart), so it gets 80 — not 26.
 * A job with no heartbeat yet is "waiting" (just deployed, or monthly and not
 * due), never "late".
 */

export interface JobDef {
  id: string
  /** Plain-language name an owner would recognise. */
  label: string
  maxGapHours: number
}

export const JOBS: readonly JobDef[] = [
  { id: 'fan-out-brief-cron',          label: 'Morning briefs',              maxGapHours: 80 },
  { id: 'fan-out-debt-recovery-cron',  label: 'Daily payment reminders',     maxGapHours: 30 },
  { id: 'cashflow-forecast-weekly',    label: 'Weekly cash forecast',        maxGapHours: 200 },
  { id: 'fan-out-health-score-cron',   label: 'Weekly health scores',        maxGapHours: 200 },
  { id: 'deadline-alert-cron',         label: 'Compliance deadline alerts',  maxGapHours: 30 },
  { id: 'low-stock-alert-cron',        label: 'Low-stock alerts',            maxGapHours: 30 },
  { id: 'approval-reminder-cron',      label: 'Approval reminders',          maxGapHours: 30 },
  { id: 'process-queue-cron',          label: 'Automation queue',            maxGapHours: 1 },
  { id: 'signal-refresh-cron',         label: 'Dashboard signals',           maxGapHours: 3 },
  { id: 'trial-expiry-cron',           label: 'Trial expiry',                maxGapHours: 30 },
  { id: 'sequences-cron',              label: 'Message sequences',           maxGapHours: 3 },
  { id: 'escalate-conversations-cron', label: 'Conversation escalation',     maxGapHours: 1 },
  { id: 'account-deletion-purge',      label: 'Account deletion (POPIA)',    maxGapHours: 30 },
  { id: 'payroll-reminder-cron',       label: 'Payroll reminder',            maxGapHours: 800 },
]

export type JobState = 'ok' | 'late' | 'failing' | 'waiting'

export interface Heartbeat {
  last_ok_at: string | null
  last_error_at: string | null
}

/**
 * ok       ran within its window
 * failing  its most recent run failed (a later success clears it)
 * late     has run before, but not within its window
 * waiting  never recorded yet
 */
export function jobState(hb: Heartbeat | null | undefined, maxGapHours: number, now: Date = new Date()): JobState {
  if (!hb || (!hb.last_ok_at && !hb.last_error_at)) return 'waiting'
  const ok = hb.last_ok_at ? Date.parse(hb.last_ok_at) : null
  const err = hb.last_error_at ? Date.parse(hb.last_error_at) : null
  if (err !== null && (ok === null || err > ok)) return 'failing'
  if (ok === null) return 'waiting'
  return now.getTime() - ok > maxGapHours * 3_600_000 ? 'late' : 'ok'
}
