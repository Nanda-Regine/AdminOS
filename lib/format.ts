/**
 * Single source of truth for money + number formatting across AdminOS.
 * ZAR, en-ZA grouping. Use `formatZAR` everywhere instead of hand-rolling
 * `.toLocaleString()` — it keeps tables and cards consistent and lets us
 * change the house style in one place.
 */

const zarWhole = new Intl.NumberFormat('en-ZA', {
  style: 'currency',
  currency: 'ZAR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

const zarCents = new Intl.NumberFormat('en-ZA', {
  style: 'currency',
  currency: 'ZAR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** `R 12 500` (no cents by default) or `R 12 500,00` with `{ cents: true }`. */
export function formatZAR(amount: number | null | undefined, opts?: { cents?: boolean }): string {
  const n = Number(amount ?? 0)
  if (!Number.isFinite(n)) return 'R 0'
  return (opts?.cents ? zarCents : zarWhole).format(n)
}

/** Compact money for hero figures: `R 1,2M`, `R 340K`, `R 8 500`. */
export function formatZARCompact(amount: number | null | undefined): string {
  const n = Number(amount ?? 0)
  if (!Number.isFinite(n)) return 'R 0'
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `R ${(n / 1_000_000).toLocaleString('en-ZA', { maximumFractionDigits: 1 })}M`
  if (abs >= 10_000)    return `R ${Math.round(n / 1000).toLocaleString('en-ZA')}K`
  return formatZAR(n)
}

const monthShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** `2026-06-17` -> `17 Jun 2026`. Calendar dates only (no timezone shift); anything else is returned unchanged. */
export function formatDateShort(ymd: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd ?? '')
  if (!m) return ymd ?? ''
  return `${Number(m[3])} ${monthShort[Number(m[2]) - 1]} ${m[1]}`
}

/** Plain grouped integer, no currency: `12 500`. */
export function formatNumber(n: number | null | undefined): string {
  return Number(n ?? 0).toLocaleString('en-ZA', { maximumFractionDigits: 0 })
}
