/**
 * Days-overdue, computed — never read from a stored column.
 *
 * There is unresolved schema drift on invoices.days_overdue: one schema file
 * declares it a GENERATED column, another says it is not stored at all (a
 * generated column cannot use CURRENT_DATE, which is not immutable, so the
 * "generated" version could never have been created as written). The debt cron
 * used to filter `.gt('days_overdue', 0)` directly, so whether debt recovery
 * ran AT ALL depended on which schema prod happened to get — and if the column
 * was absent, the query errored, got swallowed by `data ?? []`, and the cron
 * silently reported zero every morning.
 *
 * Computing from due_date removes that dependency entirely: it works whether or
 * not the column exists, and it is always fresh (a stored value can lag reality
 * by however long since the last write). due_date is fundamental to an invoice
 * and is present in every schema.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000
// SAST = UTC+2, no DST. Inlined (not imported from lib/time/sast) so this
// module stays import-free for the node test runner.
const SAST_OFFSET_MS = 2 * 60 * 60 * 1000

/**
 * Whole days a due date is past, floored at 0. Not-yet-due or missing → 0.
 * Date-only difference against the SAST calendar day: an invoice due
 * yesterday is overdue from 00:00 SAST, not 02:00 (Vercel runs in UTC).
 */
export function daysOverdue(dueDate: string | Date | null | undefined, now: Date = new Date()): number {
  if (!dueDate) return 0
  const due = dueDate instanceof Date ? dueDate : new Date(dueDate)
  if (isNaN(due.getTime())) return 0

  const dueMidnight = Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate())
  const sast = new Date(now.getTime() + SAST_OFFSET_MS)
  const nowMidnight = Date.UTC(sast.getUTCFullYear(), sast.getUTCMonth(), sast.getUTCDate())

  const diff = Math.floor((nowMidnight - dueMidnight) / MS_PER_DAY)
  return diff > 0 ? diff : 0
}

/** Today's SAST date as YYYY-MM-DD — for a `due_date < :today` query bound. */
export function todayDateString(now: Date = new Date()): string {
  return new Date(now.getTime() + SAST_OFFSET_MS).toISOString().slice(0, 10)
}
