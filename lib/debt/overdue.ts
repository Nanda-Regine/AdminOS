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

/**
 * Whole days a due date is past, floored at 0. Not-yet-due or missing → 0.
 * Date-only difference in UTC — matches the DB's GREATEST(0, CURRENT_DATE -
 * due_date) closely enough for tiering; a few hours' timezone skew never moves
 * an invoice more than one day, and the tiers have multi-day bands.
 */
export function daysOverdue(dueDate: string | Date | null | undefined, now: Date = new Date()): number {
  if (!dueDate) return 0
  const due = dueDate instanceof Date ? dueDate : new Date(dueDate)
  if (isNaN(due.getTime())) return 0

  const dueMidnight = Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate())
  const nowMidnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())

  const diff = Math.floor((nowMidnight - dueMidnight) / MS_PER_DAY)
  return diff > 0 ? diff : 0
}

/** Today's date as YYYY-MM-DD (UTC) — for a `due_date < :today` query bound. */
export function todayDateString(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10)
}
