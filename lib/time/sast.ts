/**
 * South African wall-clock time (SAST = UTC+2, no daylight saving).
 *
 * Vercel runs in UTC, so `new Date().getHours()` and `toISOString().slice(0,10)`
 * are two hours behind the business: between 00:00 and 02:00 SAST "today" was
 * still yesterday, and the dashboard said "Good morning" until 14:00.
 * Use these wherever a page shows or filters by the business's calendar day.
 *
 * No imports, so tests load it under `node --experimental-strip-types`.
 */

export const SAST_OFFSET_MS = 2 * 3600_000

/** The SAST calendar date, `YYYY-MM-DD`. */
export function sastDate(now: Date = new Date()): string {
  return new Date(now.getTime() + SAST_OFFSET_MS).toISOString().slice(0, 10)
}

/** The SAST hour, 0–23. */
export function sastHour(now: Date = new Date()): number {
  return new Date(now.getTime() + SAST_OFFSET_MS).getUTCHours()
}

/** UTC instant of 00:00 SAST on the given SAST date (default: today). */
export function sastDayStartUTC(date: string = sastDate()): string {
  return new Date(`${date}T00:00:00+02:00`).toISOString()
}

/** UTC instant of 00:00 SAST on the 1st of the current SAST month. */
export function sastMonthStartUTC(now: Date = new Date()): string {
  return sastDayStartUTC(`${sastDate(now).slice(0, 7)}-01`)
}

export function greetingFor(hour: number): string {
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
}

/** e.g. "Tuesday, 6 October", in SAST. */
export function sastDateLabel(now: Date = new Date()): string {
  return now.toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Africa/Johannesburg' })
}

/**
 * Whole days from today (SAST) to a `YYYY-MM-DD` date: 0 = today, negative =
 * past. Calendar arithmetic on the dates themselves, so the UTC server and a
 * SAST browser agree — `new Date(d + 'T00:00:00')` is runtime-local midnight
 * and was a day out between 00:00 and 02:00 SAST (and failed hydration).
 */
export function daysUntil(ymd: string, now: Date = new Date()): number {
  const n = (s: string) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / 86_400_000
  return n(ymd) - n(sastDate(now))
}
