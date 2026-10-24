/**
 * Reminder cadence — how soon an invoice may be chased again.
 *
 * Without a guard the daily sweep re-sends to the same debtor every morning
 * once WhatsApp is live, and the manual "Send reminders" button can be
 * pressed repeatedly. Import-free so the node test runner loads it directly.
 */

const HOUR_MS = 60 * 60 * 1000

/** Unattended sweep: at most one reminder every 3 days per invoice. */
export const AUTO_MIN_GAP_HOURS = 72
/** Owner pressed the button: allow a re-send after a day, never a double-tap. */
export const MANUAL_MIN_GAP_HOURS = 24

/** True when a reminder went out too recently for another to be sent. */
export function reminderTooSoon(
  lastSentAt: string | null | undefined,
  manual: boolean,
  now: Date = new Date(),
): boolean {
  if (!lastSentAt) return false
  const sent = Date.parse(lastSentAt)
  if (Number.isNaN(sent)) return false
  const gapHours = manual ? MANUAL_MIN_GAP_HOURS : AUTO_MIN_GAP_HOURS
  return now.getTime() - sent < gapHours * HOUR_MS
}
