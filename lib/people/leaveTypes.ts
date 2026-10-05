/**
 * BCEA leave types. Only annual leave draws down `staff.leave_balance` /
 * `staff.leave_taken`; the others are statutory entitlements of their own
 * (sick: 30 days per 36-month cycle, s22; family responsibility: 3 days a
 * year, s27; maternity: 4 months, s25; parental: 10 days, s25A) and must never
 * be deducted from annual leave.
 *
 * No imports — shared by API routes and tests.
 */

export const LEAVE_TYPES = [
  'annual', 'sick', 'family_responsibility', 'maternity', 'parental', 'study', 'unpaid',
] as const
export type LeaveType = (typeof LEAVE_TYPES)[number]

export const LEAVE_LABELS: Record<LeaveType, string> = {
  annual: 'Annual leave',
  sick: 'Sick leave',
  family_responsibility: 'Family responsibility',
  maternity: 'Maternity leave',
  parental: 'Parental leave',
  study: 'Study leave',
  unpaid: 'Unpaid leave',
}

/** Does approving this type use up annual leave? */
export function drawsAnnualBalance(type: string | null | undefined): boolean {
  return (type ?? 'annual') === 'annual'
}

/**
 * BCEA s23: an employer may require a medical certificate for sick leave of
 * more than two consecutive days (or on a Monday/Friday pattern). Shown to the
 * employee when they file, so it isn't a surprise at approval.
 */
export function needsMedicalCertificate(type: string, workingDays: number): boolean {
  return type === 'sick' && workingDays > 2
}
