import { daysUntil } from '../time/sast.ts'

export type ComplianceStatus = 'upcoming' | 'due' | 'overdue' | 'completed' | 'not_applicable'

/**
 * A compliance item's status as of today (SAST). The stored status is only
 * recomputed by a trigger when a row is written, so a row nobody has touched
 * since it was seeded keeps saying "upcoming" long after its date has passed.
 * Terminal states set by a human always win; everything else follows the date,
 * using the same rule as compliance_item_compute_status().
 */
export function effectiveStatus(
  stored: string,
  dueDate: string | null,
  alertDaysBefore = 30,
  now: Date = new Date(),
): ComplianceStatus {
  if (stored === 'completed' || stored === 'not_applicable') return stored
  if (!dueDate) return 'upcoming'
  const n = daysUntil(dueDate, now)
  if (n < 0) return 'overdue'
  return n <= alertDaysBefore ? 'due' : 'upcoming'
}
