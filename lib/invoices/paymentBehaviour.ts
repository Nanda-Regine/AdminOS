/**
 * How customers actually pay — learned from invoices that have been paid.
 * Pure (no imports) so tests load it directly. Dates are SAST `YYYY-MM-DD`.
 *
 * Replaces the forecast's one fixed "85% if not yet due, 15% if 60+ days late"
 * curve with each customer's own history where there is enough of it. All of it
 * is an ESTIMATE: a customer needs MIN_CONTACT paid invoices before their own
 * pattern is used, and a business needs MIN_TENANT before its overall pattern
 * is used for customers we have no history on. Below that, the old curve stays.
 */

export const MIN_CONTACT = 3
export const MIN_TENANT = 5

export interface PaidSample {
  key: string
  dueDate: string
  paidOn: string
}

export interface Behaviour {
  /** Paid invoices this is based on. */
  n: number
  /** Median days after the due date that payment arrived (negative = early). */
  medianDaysLate: number
  /** Share of those invoices paid after the due date, 0–1. */
  lateRate: number
}

export interface BehaviourModel {
  byKey: Map<string, Behaviour>
  tenant: Behaviour | null
}

const DAY = 86_400_000
const ts = (d: string) => Date.parse(`${d}T00:00:00Z`)
export const daysBetween = (from: string, to: string) => Math.round((ts(to) - ts(from)) / DAY)
export const addDays = (d: string, n: number) => new Date(ts(d) + n * DAY).toISOString().slice(0, 10)

/** Same customer, same key: the contact id when there is one, else the name without case or spacing. */
export function contactKey(contactId: string | null | undefined, name: string | null | undefined): string | null {
  if (contactId) return `c:${contactId}`
  const n = (name ?? '').toLowerCase().replace(/\s+/g, ' ').trim()
  return n ? `n:${n}` : null
}

function summarise(daysLate: number[]): Behaviour {
  const sorted = [...daysLate].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
  return {
    n: sorted.length,
    // One customer who paid a year late once shouldn't push every future date out a year.
    medianDaysLate: Math.max(-30, Math.min(90, Math.round(median))),
    lateRate: sorted.filter((d) => d > 0).length / sorted.length,
  }
}

export function buildBehaviour(samples: readonly PaidSample[]): BehaviourModel {
  const per = new Map<string, number[]>()
  const all: number[] = []
  for (const s of samples) {
    if (!s.dueDate || !s.paidOn) continue
    const late = daysBetween(s.dueDate, s.paidOn)
    if (!Number.isFinite(late)) continue
    all.push(late)
    per.set(s.key, [...(per.get(s.key) ?? []), late])
  }
  const byKey = new Map<string, Behaviour>()
  for (const [key, list] of per) if (list.length >= MIN_CONTACT) byKey.set(key, summarise(list))
  return { byKey, tenant: all.length >= MIN_TENANT ? summarise(all) : null }
}

/** The customer's own pattern, else the business's overall pattern, else null (use the default curve). */
export function pickBehaviour(model: BehaviourModel, key: string | null): { behaviour: Behaviour; scope: 'contact' | 'tenant' } | null {
  const own = key ? model.byKey.get(key) : undefined
  if (own) return { behaviour: own, scope: 'contact' }
  return model.tenant ? { behaviour: model.tenant, scope: 'tenant' } : null
}

/** The fixed curve used when there is no history: chance an invoice is paid, by days overdue. */
export function defaultProbability(daysOver: number): number {
  if (daysOver <= 0) return 0.85
  if (daysOver <= 7) return 0.80
  if (daysOver <= 14) return 0.70
  if (daysOver <= 30) return 0.55
  if (daysOver <= 60) return 0.35
  return 0.15
}

export interface Collection {
  date: string
  probability: number
  basis: 'default' | 'business' | 'customer'
}

/**
 * When an open invoice is expected to be paid and how likely that is.
 * Overdue invoices are never dated in the past: at the earliest in 3 days.
 * A customer's own history moves both the date and the odds; the business-wide
 * pattern only moves the date (it says little about one particular customer's odds).
 */
export function expectedCollection(
  inv: { dueDate: string },
  today: string,
  picked: ReturnType<typeof pickBehaviour>,
): Collection {
  const daysOver = daysBetween(inv.dueDate, today)
  const base = defaultProbability(daysOver)
  const fallbackDate = daysOver > 0 ? addDays(today, Math.max(3, Math.min(14, 30 - daysOver))) : inv.dueDate
  if (!picked) return { date: fallbackDate, probability: base, basis: 'default' }

  const { behaviour: b, scope } = picked
  const predicted = addDays(inv.dueDate, b.medianDaysLate)
  // Already past the date they'd usually pay by → they're slower than their pattern: fall back to the overdue rule.
  const date = predicted > today ? predicted : (daysOver > 0 ? fallbackDate : addDays(today, 1))

  let probability = base
  if (scope === 'contact') {
    if (b.lateRate <= 0.2) probability = Math.min(0.95, base + 0.10)
    else if (b.lateRate >= 0.8) probability = Math.max(0.05, base - 0.15)
  }
  return { date, probability, basis: scope === 'contact' ? 'customer' : 'business' }
}

/** Plain-language habit for a customer, e.g. "Usually pays 9 days late (4 invoices)". Estimate; only for customers with their own history. */
export function describeHabit(b: Behaviour): string {
  const inv = `${b.n} invoice${b.n === 1 ? '' : 's'}`
  if (b.medianDaysLate > 0) return `Usually pays ${b.medianDaysLate} day${b.medianDaysLate === 1 ? '' : 's'} late (${inv})`
  if (b.medianDaysLate < 0) return `Usually pays ${-b.medianDaysLate} day${b.medianDaysLate === -1 ? '' : 's'} early (${inv})`
  return `Usually pays on the due date (${inv})`
}
