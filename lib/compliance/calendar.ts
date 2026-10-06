/**
 * The SA statutory compliance calendar: which deadlines a business has, on
 * which dates, for the next 12 months.
 *
 * Replaces the SQL function seed_compliance_calendar, which (Session 20):
 *   - put EMP201 on the 7th, 8th or 10th (month start + 37 days) and never
 *     moved it off a weekend or public holiday;
 *   - dated IRP6 and ITR14 as if every business had a December year end, and
 *     ignored its own financial-year-end parameter (most SA SMEs end in Feb);
 *   - swapped the EMP501 descriptions (May is the annual reconciliation);
 *   - put the COIDA Return of Earnings on 31 March, before the window opens;
 *   - gave every brand-new tenant an already-"overdue" IRP6 item;
 *   - invented a CIPC annual-return date from the signup date;
 *   - covered 12 months once, with nothing rolling it forward.
 *
 * Sources (checked 2026-10-06):
 *   EMP201  SARS "Completing the monthly employer declaration": the 7th of the
 *           following month, or the last business day before it.
 *   EMP501  SARS: annual reconciliation (March–February) closes 31 May; interim
 *           (March–August) closes 31 October.
 *   IRP6    SARS provisional tax: 1st payment within six months of the start of
 *           the year of assessment (31 August for a March start); 2nd by the last
 *           business day of the year of assessment (last business day of Feb).
 *   ITR14   SARS: within 12 months after the financial year end
 *           (year end 28 Feb 2025 → due 28 Feb 2026).
 *   COIDA   Compensation Fund Return of Earnings: filing season opens in April
 *           and closes 31 May unless the Fund gazettes otherwise (2025: 30 June).
 *   NPO     Nonprofit Organisations Act 71 of 1997 s18(1)(a): narrative report,
 *           AFS and accounting officer's report within nine months after the end
 *           of the financial year.
 * CIPC annual returns fall due on the company's incorporation anniversary, so
 * they are only scheduled when that date is known.
 *
 * Pure: no I/O, no `@/` imports (tests load it under node's strip-types mode).
 */
import { businessDayOnOrBefore, emp201DueDate } from '../people/workingDays.ts'

export interface CalendarItem {
  item_type: string
  title: string
  description: string
  due_date: string // YYYY-MM-DD
  recurrence: 'monthly' | 'bi-annual' | 'annual'
  penalty_description: string
}

export interface CalendarOptions {
  /** SAST calendar date the window starts on, YYYY-MM-DD. */
  today: string
  /** Month the financial year ends in, 1–12. SA default: February. */
  fyEndMonth?: number
  /** tenants.business_type — 'ngo' adds the NPO Act annual report. */
  businessType?: string | null
  /** Company incorporation date, YYYY-MM-DD, if known — schedules the CIPC annual return. */
  incorporationDate?: string | null
  /** How far ahead to schedule, in months. */
  months?: number
}

/** The statutory item types this module owns (and may repair). */
export const STATUTORY_TYPES = ['emp201', 'emp501_annual', 'emp501_interim', 'irp6_p1', 'irp6_p2', 'itr14', 'coida', 'npo_annual', 'cipc_annual'] as const

const pad = (n: number) => String(n).padStart(2, '0')
const ymd = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate()
/** Month arithmetic on (year, month 1–12). */
function addMonths(y: number, m: number, n: number): [number, number] {
  const idx = y * 12 + (m - 1) + n
  return [Math.floor(idx / 12), (idx % 12) + 1]
}
const endOfMonth = (y: number, m: number) => ymd(y, m, lastDay(y, m))

export function statutoryCalendar(opts: CalendarOptions): CalendarItem[] {
  const fyEnd = opts.fyEndMonth && opts.fyEndMonth >= 1 && opts.fyEndMonth <= 12 ? opts.fyEndMonth : 2
  const months = opts.months ?? 12
  const [ty, tm] = [Number(opts.today.slice(0, 4)), Number(opts.today.slice(5, 7))]
  const [hy, hm] = addMonths(ty, tm, months)
  const horizon = ymd(hy, hm, Math.min(Number(opts.today.slice(8, 10)), lastDay(hy, hm)))
  const inWindow = (d: string) => d >= opts.today && d <= horizon
  const items: CalendarItem[] = []
  const push = (it: CalendarItem) => { if (inWindow(it.due_date)) items.push(it) }

  // Candidate years: wide enough that every annual date in the window is seen.
  const years = [ty - 1, ty, ty + 1, ty + 2]

  // EMP201 — one per payroll month; the window decides which.
  for (let i = -1; i <= months; i++) {
    const [y, m] = addMonths(ty, tm, i)
    push({
      item_type: 'emp201',
      title: 'EMP201 — PAYE, UIF, SDL Submission',
      description: `Monthly employer declaration and payment to SARS for ${new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-ZA', { month: 'long', year: 'numeric', timeZone: 'UTC' })} payroll. Due the 7th, or the last business day before it.`,
      due_date: emp201DueDate(y, m),
      recurrence: 'monthly',
      penalty_description: '10% late-payment penalty on the outstanding amount, plus interest',
    })
  }

  for (const y of years) {
    // EMP501
    push({
      item_type: 'emp501_annual',
      title: 'EMP501 — Annual Employer Reconciliation',
      description: `Reconcile PAYE/UIF/SDL for 1 March ${y - 1} – end of February ${y} and issue IRP5/IT3(a) certificates. Filing season 1 April – 31 May.`,
      due_date: ymd(y, 5, 31),
      recurrence: 'annual',
      penalty_description: 'Administrative penalties for late submission; employees cannot file their returns without IRP5s',
    })
    push({
      item_type: 'emp501_interim',
      title: 'EMP501 — Interim Employer Reconciliation',
      description: `Reconcile PAYE/UIF/SDL for 1 March – 31 August ${y}. Submission window closes 31 October.`,
      due_date: ymd(y, 10, 31),
      recurrence: 'annual',
      penalty_description: 'Administrative non-compliance penalties',
    })

    // Financial year ending in month `fyEnd` of year y.
    const [sy, sm] = addMonths(y, fyEnd, -11) // first month of that financial year
    const [p1y, p1m] = addMonths(sy, sm, 5)   // sixth month of the year
    push({
      item_type: 'irp6_p1',
      title: 'IRP6 — Provisional Tax, 1st payment',
      description: `First provisional tax payment for the year ending ${endOfMonth(y, fyEnd)}: within six months of the start of the year.`,
      due_date: businessDayOnOrBefore(endOfMonth(p1y, p1m)),
      recurrence: 'annual',
      penalty_description: '10% late-payment penalty plus interest; 20% underestimation penalty on the 2nd payment',
    })
    push({
      item_type: 'irp6_p2',
      title: 'IRP6 — Provisional Tax, 2nd payment',
      description: `Second provisional tax payment: by the last business day of the year ending ${endOfMonth(y, fyEnd)}.`,
      due_date: businessDayOnOrBefore(endOfMonth(y, fyEnd)),
      recurrence: 'annual',
      penalty_description: '10% late-payment penalty plus interest; 20% underestimation penalty',
    })
    const [ry, rm] = addMonths(y, fyEnd, 12)
    push({
      item_type: 'itr14',
      title: opts.businessType === 'ngo' ? 'Annual income tax return (ITR14, or IT12EI if tax-exempt)' : 'ITR14 — Company Income Tax Return',
      description: `Income tax return for the year ended ${endOfMonth(y, fyEnd)}: due within 12 months of year end.`,
      due_date: endOfMonth(ry, rm),
      recurrence: 'annual',
      penalty_description: 'Administrative penalties of R250–R16,000 per month while outstanding',
    })

    // COIDA Return of Earnings for the assessment year ending February of y.
    push({
      item_type: 'coida',
      title: 'COIDA — Return of Earnings (W.As.8)',
      description: `Return of Earnings to the Compensation Fund for March ${y - 1} – February ${y}. Filing season opens in April and closes 31 May unless the Fund gazettes an extension.`,
      due_date: ymd(y, 5, 31),
      recurrence: 'annual',
      penalty_description: 'Late-submission penalty; no Letter of Good Standing until filed',
    })

    if (opts.businessType === 'ngo') {
      const [ny, nm] = addMonths(y, fyEnd, 9)
      push({
        item_type: 'npo_annual',
        title: 'NPO Annual Report (DSD)',
        description: `Narrative report, annual financial statements and accounting officer's report for the year ended ${endOfMonth(y, fyEnd)}: within nine months of year end (NPO Act s18).`,
        due_date: endOfMonth(ny, nm),
        recurrence: 'annual',
        penalty_description: 'Deregistration as an NPO (s21) for failing to report',
      })
    }

    if (opts.incorporationDate && /^\d{4}-\d{2}-\d{2}$/.test(opts.incorporationDate)) {
      const im = Number(opts.incorporationDate.slice(5, 7))
      const id = Math.min(Number(opts.incorporationDate.slice(8, 10)), lastDay(y, im))
      if (y > Number(opts.incorporationDate.slice(0, 4))) {
        push({
          item_type: 'cipc_annual',
          title: 'CIPC Annual Return',
          description: 'Annual return to CIPC on the anniversary of incorporation; file within 30 business days of that date.',
          due_date: ymd(y, im, id),
          recurrence: 'annual',
          penalty_description: 'Late-filing fees; deregistration after continued non-filing',
        })
      }
    }
  }

  return items.sort((a, b) => a.due_date.localeCompare(b.due_date) || a.item_type.localeCompare(b.item_type))
}

// ── Sync plan ────────────────────────────────────────────────────────────────

export interface ExistingRow {
  id: string
  item_type: string
  due_date: string
  status: string | null
  completed_at: string | null
  deleted_at: string | null
}

export interface SyncPlan {
  insert: CalendarItem[]
  /** Rows to revive and/or rewrite with the correct title/description. */
  update: { id: string; item: CalendarItem; revive: boolean }[]
  /** Open rows on a date the rules never produce (the old SQL seed's mistakes). */
  softDelete: string[]
}

/** Types the old SQL seed wrote that this module replaces. */
const LEGACY_TYPES = ['emp501_may', 'emp501_oct']

/**
 * Turn a tenant's current rows into the correct calendar without losing work:
 * completed rows are never touched; open rows on a wrong date are soft-deleted;
 * right dates are kept (text refreshed), revived if soft-deleted, or inserted.
 * Past open rows are kept only where the rules really put a deadline, so a
 * genuinely missed EMP201 stays overdue while an invented one disappears.
 */
export function planCalendarSync(existing: ExistingRow[], opts: CalendarOptions): SyncPlan {
  const ahead = statutoryCalendar(opts)
  const [ty, tm] = [Number(opts.today.slice(0, 4)), Number(opts.today.slice(5, 7))]
  const [py, pm] = addMonths(ty, tm, -12)
  const pastStart = ymd(py, pm, Math.min(Number(opts.today.slice(8, 10)), lastDay(py, pm)))
  const behind = statutoryCalendar({ ...opts, today: pastStart }).filter(i => i.due_date < opts.today)
  const correct = new Map([...behind, ...ahead].map(i => [`${i.item_type}|${i.due_date}`, i]))
  const owned = new Set<string>([...STATUTORY_TYPES, ...LEGACY_TYPES])

  const plan: SyncPlan = { insert: [], update: [], softDelete: [] }
  const seen = new Set<string>()
  for (const row of existing) {
    if (!owned.has(row.item_type)) continue
    const key = `${row.item_type}|${row.due_date}`
    const done = row.status === 'completed' || row.completed_at !== null || row.status === 'not_applicable'
    const item = correct.get(key)
    if (item) {
      seen.add(key)
      if (!done) plan.update.push({ id: row.id, item, revive: row.deleted_at !== null })
    } else if (!done && row.deleted_at === null) {
      plan.softDelete.push(row.id)
    }
  }
  for (const item of ahead) if (!seen.has(`${item.item_type}|${item.due_date}`)) plan.insert.push(item)
  return plan
}
