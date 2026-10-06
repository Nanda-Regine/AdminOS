/** South African formatting: R 1 234,56 · 6 Oct 2026 · SAST. */

const ZAR = new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', minimumFractionDigits: 2 })

export function zar(amount: number | string | null | undefined): string {
  const n = Number(amount ?? 0)
  return ZAR.format(Number.isFinite(n) ? n : 0)
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export function monthName(m: number): string {
  return MONTHS[(m - 1 + 12) % 12] ?? ''
}

/** 'YYYY-MM-DD' or ISO → "6 Oct 2026". Date-only strings are not shifted by timezone. */
export function shortDate(value: string | null | undefined): string {
  if (!value) return '—'
  const d = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function time(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })
}

export function relative(value: string | null | undefined, now = Date.now()): string {
  if (!value) return ''
  const t = new Date(value).getTime()
  if (Number.isNaN(t)) return ''
  const s = Math.round((now - t) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`
  if (s < 7 * 86400) return `${Math.floor(s / 86400)} d ago`
  return shortDate(value)
}

/** Today in South Africa as YYYY-MM-DD (UTC+2, no DST). */
export function saToday(now = new Date()): string {
  return new Date(now.getTime() + 2 * 3600_000).toISOString().slice(0, 10)
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function greeting(now = new Date()): string {
  const h = (now.getUTCHours() + 2) % 24
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

export const LEAVE_LABEL: Record<string, string> = {
  annual: 'Annual leave',
  sick: 'Sick leave',
  family_responsibility: 'Family responsibility',
  maternity: 'Maternity leave',
  parental: 'Parental leave',
  study: 'Study leave',
  unpaid: 'Unpaid leave',
}
