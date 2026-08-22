/**
 * Pure month-grid math for the business calendar (/dashboard/calendar).
 * No framework/DB coupling on purpose — easy to unit test, easy to reuse if
 * a second calendar view (e.g. a staff-only leave calendar) ever needs the
 * same grid.
 */

export interface CalendarDay {
  /** YYYY-MM-DD, always in the tenant's local calendar date, never a UTC instant. */
  date: string
  dayOfMonth: number
  isCurrentMonth: boolean
  isToday: boolean
  isWeekend: boolean
}

function toDateStr(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/**
 * Builds a Monday-first month grid (SA/international business week) padded
 * with the trailing days of the previous month and leading days of the next
 * so every week row has exactly 7 days — a full grid, never a ragged one.
 */
export function buildMonthGrid(year: number, month: number, todayStr: string): CalendarDay[][] {
  const firstOfMonth   = new Date(Date.UTC(year, month, 1))
  const daysInMonth    = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  const daysInPrevMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()

  // getUTCDay(): 0=Sun..6=Sat. Convert to Monday-first offset (0=Mon..6=Sun).
  const firstWeekday = (firstOfMonth.getUTCDay() + 6) % 7

  const cells: CalendarDay[] = []

  // Leading days from the previous month
  for (let i = firstWeekday - 1; i >= 0; i--) {
    const d = daysInPrevMonth - i
    const [py, pm] = month === 0 ? [year - 1, 11] : [year, month - 1]
    const dateStr = toDateStr(py, pm, d)
    cells.push({ date: dateStr, dayOfMonth: d, isCurrentMonth: false, isToday: dateStr === todayStr, isWeekend: false })
  }

  // The month itself
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = toDateStr(year, month, d)
    const weekday = (new Date(Date.UTC(year, month, d)).getUTCDay() + 6) % 7
    cells.push({ date: dateStr, dayOfMonth: d, isCurrentMonth: true, isToday: dateStr === todayStr, isWeekend: weekday >= 5 })
  }

  // Trailing days from the next month, padded to a multiple of 7
  const [ny, nm] = month === 11 ? [year + 1, 0] : [year, month + 1]
  let nextDay = 1
  while (cells.length % 7 !== 0) {
    const dateStr = toDateStr(ny, nm, nextDay)
    cells.push({ date: dateStr, dayOfMonth: nextDay, isCurrentMonth: false, isToday: dateStr === todayStr, isWeekend: false })
    nextDay++
  }

  const weeks: CalendarDay[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}

/** First and last date (YYYY-MM-DD) actually shown in the grid, incl. padding. */
export function monthGridRange(weeks: CalendarDay[][]): { from: string; to: string } {
  return { from: weeks[0][0].date, to: weeks[weeks.length - 1][6].date }
}

export function monthLabel(year: number, month: number): string {
  return new Date(Date.UTC(year, month, 1)).toLocaleDateString('en-ZA', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

/** Clamps an arbitrary ?month= query param to a valid {year, month} pair, defaulting to today. */
export function parseMonthParam(param: string | undefined, todayStr: string): { year: number; month: number } {
  const fallback = { year: Number(todayStr.slice(0, 4)), month: Number(todayStr.slice(5, 7)) - 1 }
  if (!param || !/^\d{4}-\d{2}$/.test(param)) return fallback
  const [y, m] = param.split('-').map(Number)
  if (m < 1 || m > 12) return fallback
  return { year: y, month: m - 1 }
}

export function adjacentMonthParam(year: number, month: number, delta: 1 | -1): string {
  const d = new Date(Date.UTC(year, month + delta, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}
