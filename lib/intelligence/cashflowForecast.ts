import { supabaseAdmin } from '@/lib/supabase/admin'
import { OPEN_INVOICE_STATUSES, outstanding } from '@/lib/invoices/status'
import { emp201DueDate } from '@/lib/people/workingDays'

export interface WeeklyForecast {
  weekStart:  string   // ISO date
  weekEnd:    string
  inflows:    number
  outflows:   number
  net:        number
  balance:    number   // running balance at end of week
}

export interface CashflowForecast {
  tenantId:         string
  forecastDate:     string
  openingBalance:   number
  closingBalance:   number
  projectedInflows: ForecastItem[]
  projectedOutflows: ForecastItem[]
  netByWeek:        WeeklyForecast[]
  lowestPoint:      number
  lowestPointDate:  string
  riskLevel:        'safe' | 'watch' | 'critical'
}

export interface ForecastItem {
  date:        string
  amount:      number
  label:       string
  category:    string
  probability: number   // 0–1
  source:      'invoice' | 'recurring' | 'payroll' | 'tax' | 'manual' | 'estimate'
}

// Payment probability by invoice age (days outstanding)
function paymentProbability(daysOverdue: number): number {
  if (daysOverdue <= 0)  return 0.85
  if (daysOverdue <= 7)  return 0.80
  if (daysOverdue <= 14) return 0.70
  if (daysOverdue <= 30) return 0.55
  if (daysOverdue <= 60) return 0.35
  return 0.15
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function toISO(d: Date): string {
  return d.toISOString().split('T')[0]
}

export async function generateCashflowForecast(
  tenantId: string,
  horizonDays = 90
): Promise<CashflowForecast> {
  const today       = new Date()
  const horizonEnd  = addDays(today, horizonDays)

  const [invoicesResult, expensesResult, payrollResult, tenantResult] = await Promise.all([
    // Outstanding invoices
    supabaseAdmin
      .from('invoices')
      .select('id, amount, amount_paid, due_date, status, created_at')
      .eq('tenant_id', tenantId)
      .in('status', [...OPEN_INVOICE_STATUSES])
      .is('deleted_at', null)
      .gte('due_date', toISO(addDays(today, -90)))
      .lte('due_date', toISO(horizonEnd)),

    // Upcoming expense claims
    supabaseAdmin
      .from('expenses')
      .select('amount, submitted_at').is('deleted_at', null)
      .eq('tenant_id', tenantId)
      .eq('status', 'approved'),

    // Payroll runs
    supabaseAdmin
      .from('payroll_runs')
      .select('total_net, total_paye, total_uif_employee, total_uif_employer, total_sdl, period_month, period_year').is('deleted_at', null)
      .eq('tenant_id', tenantId)
      .in('status', ['finalised', 'paid'])
      .order('period_year', { ascending: false })
      .order('period_month', { ascending: false })
      .limit(1),

    // Tenant settings (payroll_day)
    supabaseAdmin
      .from('tenants')
      .select('id, settings')
      .eq('id', tenantId)
      .single(),
  ])

  const inflows:  ForecastItem[] = []
  const outflows: ForecastItem[] = []

  // ── Inflows from outstanding invoices ────────────────────────────────────────
  const invoices = invoicesResult.data ?? []
  const nowTs    = today.getTime()

  for (const inv of invoices) {
    const owed = outstanding(inv)
    if (!inv.due_date || owed <= 0) continue
    const dueDate   = new Date(inv.due_date)
    const daysOver  = Math.round((nowTs - dueDate.getTime()) / 86400000)
    const prob      = paymentProbability(daysOver)
    // Overdue: expect collection 3–14 days out. This was min(14, 30 − daysOver),
    // which goes negative past 16 days overdue and dated the inflow in the past.
    const collectOn = daysOver > 0
      ? toISO(addDays(today, Math.max(3, Math.min(14, 30 - daysOver))))
      : inv.due_date

    inflows.push({
      date:        collectOn,
      amount:      owed,
      label:       `Invoice payment`,
      category:    'invoice',
      probability: prob,
      source:      'invoice',
    })
  }

  // ── Outflows from approved expenses ──────────────────────────────────────────
  const expenses = expensesResult.data ?? []
  for (const exp of expenses) {
    if (!exp.amount) continue
    const payDate = toISO(addDays(new Date(exp.submitted_at), 5))
    outflows.push({
      date:        payDate,
      amount:      exp.amount,
      label:       'Expense reimbursement',
      category:    'expenses',
      probability: 1,
      source:      'recurring',
    })
  }

  // ── Outflows from payroll: every pay day in the horizon, sized on the latest run ──
  // Was ONE payroll (the 25th of next month) in a 90-day window — two to three
  // months of salaries missing — from an unordered "last" run, and only for
  // status 'finalised' (a 'paid' run is just as real). The SARS line also left
  // out the employee UIF the employer withholds and pays over on the EMP201.
  const lastRun = (payrollResult.data ?? [])[0]
  if (lastRun) {
    const settings = (tenantResult.data?.settings ?? {}) as { payroll_day?: number }
    const payDay   = Math.min(28, Math.max(1, Number(settings.payroll_day) || 25))
    const net      = Number(lastRun.total_net ?? 0)
    const sars     = Number(lastRun.total_paye ?? 0) + Number(lastRun.total_uif_employee ?? 0)
                   + Number(lastRun.total_uif_employer ?? 0) + Number(lastRun.total_sdl ?? 0)
    const todayStr = toISO(today)
    for (let m = 0; m <= 4; m++) {
      const payDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + m, payDay))
      const payStr  = toISO(payDate)
      if (payStr >= todayStr && payDate <= horizonEnd && net > 0) {
        outflows.push({ date: payStr, amount: net, label: 'Payroll (net pay)', category: 'payroll', probability: 1, source: 'payroll' })
      }
      // EMP201 for that payroll month: due the 7th of the following month,
      // moved back to the last business day if the 7th is a weekend/holiday.
      const due = emp201DueDate(payDate.getUTCFullYear(), payDate.getUTCMonth() + 1)
      if (due >= todayStr && new Date(due) <= horizonEnd && sars > 0) {
        outflows.push({ date: due, amount: sars, label: 'EMP201: PAYE + UIF + SDL (SARS)', category: 'tax', probability: 1, source: 'tax' })
      }
    }
  }

  // ── Build weekly buckets ──────────────────────────────────────────────────────
  const weeks: WeeklyForecast[] = []
  let currentWeekStart = new Date(today)
  // align to Monday
  const day = currentWeekStart.getDay()
  currentWeekStart.setDate(currentWeekStart.getDate() - (day === 0 ? 6 : day - 1))

  let runningBalance = 0  // will set opening balance below

  while (currentWeekStart <= horizonEnd) {
    const weekEnd = addDays(currentWeekStart, 6)
    const startStr = toISO(currentWeekStart)
    const endStr   = toISO(weekEnd)

    const weekInflows = inflows
      .filter(i => i.date >= startStr && i.date <= endStr)
      .reduce((s, i) => s + i.amount * i.probability, 0)

    const weekOutflows = outflows
      .filter(o => o.date >= startStr && o.date <= endStr)
      .reduce((s, o) => s + o.amount * o.probability, 0)

    runningBalance += weekInflows - weekOutflows

    weeks.push({
      weekStart:  startStr,
      weekEnd:    endStr,
      inflows:    Math.round(weekInflows),
      outflows:   Math.round(weekOutflows),
      net:        Math.round(weekInflows - weekOutflows),
      balance:    Math.round(runningBalance),
    })

    currentWeekStart = addDays(weekEnd, 1)
  }

  // Determine lowest point
  let lowestBalance = Infinity
  let lowestDate    = toISO(today)
  for (const w of weeks) {
    if (w.balance < lowestBalance) {
      lowestBalance = w.balance
      lowestDate    = w.weekEnd
    }
  }

  // Risk level
  const riskLevel: 'safe' | 'watch' | 'critical' =
    lowestBalance < 0 ? 'critical'
    : lowestBalance < 50_000 ? 'watch'
    : 'safe'

  const totalInflows  = inflows.reduce((s, i) => s + i.amount * i.probability, 0)
  const totalOutflows = outflows.reduce((s, o) => s + o.amount * o.probability, 0)

  return {
    tenantId,
    forecastDate:      toISO(today),
    openingBalance:    0,
    closingBalance:    Math.round(totalInflows - totalOutflows),
    projectedInflows:  inflows,
    projectedOutflows: outflows,
    netByWeek:         weeks,
    lowestPoint:       Math.round(lowestBalance === Infinity ? 0 : lowestBalance),
    lowestPointDate:   lowestDate,
    riskLevel,
  }
}

export async function saveCashflowForecast(forecast: CashflowForecast): Promise<void> {
  // onConflict on the real unique key (tenant_id, forecast_date). Without it the
  // upsert targeted the primary key, so a second save on the same day hit a
  // duplicate-key error — swallowed, leaving the morning's forecast in place.
  const { error } = await supabaseAdmin
    .from('cashflow_forecasts')
    .upsert({
      tenant_id:             forecast.tenantId,
      forecast_date:         forecast.forecastDate,
      forecast_horizon_days: 90,
      projected_inflows:     forecast.projectedInflows,
      projected_outflows:    forecast.projectedOutflows,
      net_by_week:           forecast.netByWeek,
      lowest_point:          forecast.lowestPoint,
      lowest_point_date:     forecast.lowestPointDate,
      risk_level:            forecast.riskLevel,
      opening_balance:       forecast.openingBalance,
      closing_balance:       forecast.closingBalance,
      generated_at:          new Date().toISOString(),
    }, { onConflict: 'tenant_id,forecast_date' })
  if (error) throw error
}
