/**
 * Working days between two dates, South African rules.
 *
 * BCEA leave is counted in *working* days: a Monday-to-Friday employee taking
 * Friday to Tuesday uses 3 days of leave, not 5, and a public holiday inside
 * the range costs no leave at all (BCEA s20(5)(b) and s21). Counting calendar
 * days over-deducted annual leave — a real cost to employees, and a CCMA risk
 * for the employer.
 *
 * Public Holidays Act 36 of 1994: twelve fixed/Easter-based days, and when a
 * holiday falls on a Sunday the following Monday is a public holiday (s2(1)).
 * Once-off declared holidays (e.g. election days) are passed in as `extra`.
 *
 * No imports: tests load this file directly under node's strip-types mode.
 * Dates are plain 'YYYY-MM-DD' strings handled in UTC, so the server timezone
 * can never shift a day.
 */

const DAY_MS = 86_400_000

/** Date-only string → UTC midnight timestamp. Throws on a malformed date. */
function toUtc(date: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!m) throw new Error(`Invalid date: ${date}`)
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  if (new Date(t).toISOString().slice(0, 10) !== date) throw new Error(`Invalid date: ${date}`)
  return t
}

function iso(t: number): string {
  return new Date(t).toISOString().slice(0, 10)
}

/** Easter Sunday (Gregorian), anonymous algorithm (Meeus/Jones/Butcher). */
export function easterSunday(year: number): string {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return iso(Date.UTC(year, month - 1, day))
}

/** Every South African public holiday in `year`, Sunday→Monday rule applied. */
export function saPublicHolidays(year: number): Set<string> {
  const fixed = ['01-01', '03-21', '04-27', '05-01', '06-16', '08-09', '09-24', '12-16', '12-25', '12-26']
  const days = fixed.map((md) => `${year}-${md}`)
  const easter = toUtc(easterSunday(year))
  days.push(iso(easter - 2 * DAY_MS)) // Good Friday
  days.push(iso(easter + DAY_MS))     // Family Day

  const out = new Set(days)
  for (const d of days) {
    const t = toUtc(d)
    if (new Date(t).getUTCDay() === 0) {
      // Sunday holiday → Monday off. If that Monday is itself a holiday
      // (25 Dec on a Sunday makes 26 Dec the Monday), the Act gives no extra day.
      out.add(iso(t + DAY_MS))
    }
  }
  return out
}

export interface WorkingDayOptions {
  /** JS weekdays worked, 0 = Sunday. Default Monday–Friday. */
  workDays?: readonly number[]
  /** Once-off declared public holidays, 'YYYY-MM-DD'. */
  extra?: readonly string[]
}

/**
 * Working days from `start` to `end` inclusive, excluding SA public holidays.
 * Throws if `end` is before `start`. Ranges are capped at 366 days — a longer
 * leave request is a data-entry error, not a leave request.
 */
export function workingDaysBetween(start: string, end: string, opts: WorkingDayOptions = {}): number {
  const s = toUtc(start)
  const e = toUtc(end)
  if (e < s) throw new Error('End date is before start date')
  if ((e - s) / DAY_MS > 366) throw new Error('Leave range is longer than a year')

  const work = new Set(opts.workDays ?? [1, 2, 3, 4, 5])
  const holidays = new Set(opts.extra ?? [])
  for (let y = new Date(s).getUTCFullYear(); y <= new Date(e).getUTCFullYear(); y++) {
    for (const h of saPublicHolidays(y)) holidays.add(h)
  }

  let n = 0
  for (let t = s; t <= e; t += DAY_MS) {
    if (work.has(new Date(t).getUTCDay()) && !holidays.has(iso(t))) n++
  }
  return n
}

/** Today's date in South Africa (UTC+2, no DST) as 'YYYY-MM-DD'. */
export function saToday(now: Date = new Date()): string {
  return iso(now.getTime() + 2 * 3600_000)
}

/** Whole calendar days from a to b (b − a), for date-only strings. */
export function daysBetween(a: string, b: string): number {
  return Math.round((toUtc(b) - toUtc(a)) / DAY_MS)
}

/**
 * The given date if it's a business day, else the last business day before it
 * (Mon–Fri, not an SA public holiday).
 */
export function businessDayOnOrBefore(date: string, extra: readonly string[] = []): string {
  let t = toUtc(date)
  for (let i = 0; i < 10; i++) {
    const d = iso(t)
    const dow = new Date(t).getUTCDay()
    const year = new Date(t).getUTCFullYear()
    if (dow !== 0 && dow !== 6 && !saPublicHolidays(year).has(d) && !extra.includes(d)) return d
    t -= DAY_MS
  }
  return iso(t)
}

/**
 * EMP201 (PAYE + UIF + SDL) due date for payroll month `month` (1–12) of `year`:
 * the 7th of the following month; if the 7th is a Saturday, Sunday or public
 * holiday, the last business day before it. Source: SARS, "Completing the
 * monthly employer declaration (EMP201)", verified 2026-10-06 —
 * https://www.sars.gov.za/types-of-tax/pay-as-you-earn/completing-the-monthly-employer-declaration-emp201/
 */
export function emp201DueDate(year: number, month: number): string {
  const y = month === 12 ? year + 1 : year
  const m = month === 12 ? 1 : month + 1
  return businessDayOnOrBefore(`${y}-${String(m).padStart(2, '0')}-07`)
}
