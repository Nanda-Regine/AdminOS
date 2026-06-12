import { supabaseAdmin } from '@/lib/supabase/admin'

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
      .select('id, total, due_date, status, created_at')
      .eq('tenant_id', tenantId)
      .in('status', ['sent', 'overdue', 'partial'])
      .gte('due_date', toISO(addDays(today, -90)))
      .lte('due_date', toISO(horizonEnd)),

    // Upcoming expense claims
    supabaseAdmin
      .from('expenses')
      .select('amount, submitted_at')
      .eq('tenant_id', tenantId)
      .eq('status', 'approved'),

    // Payroll runs
    supabaseAdmin
      .from('payroll_runs')
      .select('total_net, total_paye, total_uif_employer, total_sdl, period_month, period_year')
      .eq('tenant_id', tenantId)
      .in('status', ['finalised']),

    // Tenant plan for estimate sizing
    supabaseAdmin
      .from('tenants')
      .select('id')
      .eq('id', tenantId)
      .single(),
  ])

  const inflows:  ForecastItem[] = []
  const outflows: ForecastItem[] = []

  // ── Inflows from outstanding invoices ────────────────────────────────────────
  const invoices = invoicesResult.data ?? []
  const nowTs    = today.getTime()

  for (const inv of invoices) {
    if (!inv.due_date || !inv.total) continue
    const dueDate   = new Date(inv.due_date)
    const daysOver  = Math.round((nowTs - dueDate.getTime()) / 86400000)
    const prob      = paymentProbability(daysOver)
    const collectOn = daysOver > 0
      ? toISO(addDays(today, Math.min(14, 30 - daysOver)))  // estimate collection soon
      : inv.due_date

    inflows.push({
      date:        collectOn,
      amount:      inv.total,
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

  // ── Outflows from payroll (estimate next month's based on last run) ───────────
  const payrollRuns = payrollResult.data ?? []
  if (payrollRuns.length > 0) {
    const lastRun = payrollRuns[payrollRuns.length - 1]
    // Next payroll on 25th of next month
    const nextPayDate = new Date(today.getFullYear(), today.getMonth() + 1, 25)
    if (nextPayDate <= horizonEnd) {
      if (lastRun.total_net) {
        outflows.push({
          date:     toISO(nextPayDate),
          amount:   lastRun.total_net,
          label:    'Payroll (net pay)',
          category: 'payroll',
          probability: 1,
          source:   'payroll',
        })
      }
      // PAYE + UIF + SDL due 7th of following month
      const taxDate = new Date(today.getFullYear(), today.getMonth() + 2, 7)
      const totalTax = (lastRun.total_paye ?? 0) + (lastRun.total_uif_employer ?? 0) + (lastRun.total_sdl ?? 0)
      if (totalTax > 0 && taxDate <= horizonEnd) {
        outflows.push({
          date:     toISO(taxDate),
          amount:   totalTax,
          label:    'PAYE + UIF + SDL (SARS)',
          category: 'tax',
          probability: 1,
          source:   'payroll',
        })
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
  await supabaseAdmin
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
    })
}
