import { inngest } from '@/inngest/client'
import { supabaseAdmin } from '@/lib/supabase/admin'

type CashflowEntry = {
  tenant_id: string
  type: 'income' | 'expense'
  amount: number
  recurrence: string | null
}

// Calculates a 90-day cashflow forecast for a single tenant
async function calculateForecast(tenantId: string): Promise<{
  monthly_income: number
  monthly_expenses: number
  net_monthly: number
  runway_months: number | null
  forecast_data: object
}> {
  const [incomeResult, expenseResult] = await Promise.all([
    supabaseAdmin
      .from('cashflow_entries')
      .select('tenant_id, type, amount, recurrence')
      .eq('tenant_id', tenantId)
      .eq('type', 'income'),
    supabaseAdmin
      .from('cashflow_entries')
      .select('tenant_id, type, amount, recurrence')
      .eq('tenant_id', tenantId)
      .eq('type', 'expense'),
  ])

  const incomeEntries = (incomeResult.data ?? []) as CashflowEntry[]
  const expenseEntries = (expenseResult.data ?? []) as CashflowEntry[]

  // Only include recurring entries for forecast
  const recurringIncome = incomeEntries
    .filter((e) => e.recurrence && e.recurrence !== 'once')
    .reduce((sum, e) => sum + Number(e.amount), 0)

  const recurringExpenses = expenseEntries
    .filter((e) => e.recurrence && e.recurrence !== 'once')
    .reduce((sum, e) => sum + Number(e.amount), 0)

  const netMonthly = recurringIncome - recurringExpenses

  // Runway: how many months until cash hits zero (if net is negative)
  // We use current total pool from non-recurring income as proxy for cash on hand
  const cashOnHand = incomeEntries
    .filter((e) => !e.recurrence || e.recurrence === 'once')
    .reduce((sum, e) => sum + Number(e.amount), 0)

  let runwayMonths: number | null = null
  if (netMonthly < 0 && cashOnHand > 0) {
    runwayMonths = Math.floor(cashOnHand / Math.abs(netMonthly))
  } else if (netMonthly >= 0) {
    runwayMonths = null // Sustainable / growing
  } else {
    runwayMonths = 0 // No cash on hand and net negative
  }

  // Build 90-day projection (3 months of monthly snapshots)
  const months: Array<{ month: number; projected_balance: number }> = []
  let balance = cashOnHand
  for (let m = 1; m <= 3; m++) {
    balance += netMonthly
    months.push({ month: m, projected_balance: Math.round(balance) })
  }

  return {
    monthly_income: recurringIncome,
    monthly_expenses: recurringExpenses,
    net_monthly: netMonthly,
    runway_months: runwayMonths,
    forecast_data: {
      monthly_income: recurringIncome,
      monthly_expenses: recurringExpenses,
      net_monthly: netMonthly,
      cash_on_hand: cashOnHand,
      runway_months: runwayMonths,
      projection_90d: months,
    },
  }
}

// Runs every Monday at 6am — recalculates 90-day cashflow forecasts for all active tenants
export const cashflowForecastFunction = inngest.createFunction(
  { id: 'cashflow-forecast-weekly', retries: 2, triggers: [{ cron: '0 6 * * 1' }] },
  async ({ step }: any) => {
    // Step 1: Fetch all active tenant IDs
    const tenants = await step.run('get-active-tenants', async () => {
      const { data } = await supabaseAdmin
        .from('tenants')
        .select('id')
        .eq('status', 'active')

      return (data ?? []) as Array<{ id: string }>
    })

    if (tenants.length === 0) return { processed: 0 }

    let processed = 0
    let failed = 0
    const errors: string[] = []

    // Step 2: Calculate and upsert forecast for each tenant
    for (const tenant of tenants) {
      // eslint-disable-next-line no-await-in-loop
      const result = await step.run(`forecast-${tenant.id}`, async () => {
        try {
          const forecast = await calculateForecast(tenant.id)
          const now = new Date().toISOString()

          const { error } = await supabaseAdmin
            .from('cashflow_forecasts')
            .upsert(
              {
                tenant_id: tenant.id,
                forecast_data: forecast.forecast_data,
                calculated_at: now,
              },
              { onConflict: 'tenant_id' }
            )

          if (error) throw new Error(error.message)
          return { status: 'ok', net_monthly: forecast.net_monthly }
        } catch (err) {
          return { status: 'error', error: String(err) }
        }
      })

      if (result.status === 'ok') processed++
      else {
        failed++
        errors.push(`${tenant.id}: ${result.error}`)
      }
    }

    return { total: tenants.length, processed, failed, errors }
  }
)
