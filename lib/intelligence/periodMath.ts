/**
 * Pure helpers shared by the board pack and valuation. No imports, so tests
 * load it under `node --experimental-strip-types`.
 */

/** A SAST date range (`YYYY-MM-DD`, both ends inclusive) as UTC instants: [start, endExclusive). */
export function periodBoundsUTC(from: string, to: string): { start: string; endExclusive: string } {
  const start = new Date(`${from}T00:00:00+02:00`)
  const end   = new Date(`${to}T00:00:00+02:00`)
  end.setUTCDate(end.getUTCDate() + 1)
  return { start: start.toISOString(), endExclusive: end.toISOString() }
}

export interface PayrollRunCost {
  period_month:       number
  period_year:        number
  status:             string
  total_gross:        number | string | null
  total_uif_employer: number | string | null
  total_sdl:          number | string | null
}

/** Employer cost of finalised/paid payroll runs whose month falls in the inclusive SAST date range. */
export function payrollCostInRange(runs: PayrollRunCost[], from: string, to: string): number {
  const key = (y: number, m: number) => y * 12 + (m - 1)
  const lo = key(+from.slice(0, 4), +from.slice(5, 7))
  const hi = key(+to.slice(0, 4),   +to.slice(5, 7))
  return runs
    .filter(r => (r.status === 'finalised' || r.status === 'paid')
      && key(r.period_year, r.period_month) >= lo && key(r.period_year, r.period_month) <= hi)
    .reduce((s, r) => s + Number(r.total_gross ?? 0) + Number(r.total_uif_employer ?? 0) + Number(r.total_sdl ?? 0), 0)
}

/** Maps tenants.business_type onto the multiples tables; unknown types use `default`. */
const SECTOR_ALIAS: Record<string, string> = {
  school:     'education',
  clinic:     'healthcare',
  ngo:        'default',
  property:   'default',
  legal:      'professional',
  consulting: 'professional',
  accounting: 'professional',
  trades:     'construction',
  creative:   'media',
  events:     'media',
  cleaning:   'default',
  salons:     'retail',
}

export function valuationSector(businessType: string | null | undefined): string {
  const t = (businessType ?? '').toLowerCase()
  return SECTOR_ALIAS[t] ?? t
}
