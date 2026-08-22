import { inngest } from '@/inngest/client'
import { supabaseAdmin } from '@/lib/supabase/admin'

// Calculates a 90-day cashflow forecast for a single tenant
//
// BROKEN, not fixed here — this function has never successfully run for any
// tenant. `cashflow_entries` (a recurring income/expense line-items table)
// does not exist anywhere in the live schema, and neither `expenses` nor
// `invoices` track a `recurrence` flag that could substitute for it. This
// isn't a rename like a typical drift fix — the underlying data model this
// function assumes was never built. The original algorithm (recurring vs.
// once-off entries, runway-months, a 90-day balance projection) is sound
// design and worth keeping for whenever the real table exists:
//
//   const recurringIncome/Expenses = entries.filter(recurrence && != 'once').sum(amount)
//   netMonthly = recurringIncome - recurringExpenses
//   cashOnHand = income entries where !recurrence || recurrence === 'once', summed
//   runwayMonths = netMonthly < 0 ? floor(cashOnHand / abs(netMonthly)) : null
//   projection_90d = 3 monthly snapshots of cashOnHand + netMonthly * month
//
// Fixing it for real means either (a) a new recurring-transactions table, or
// (b) reworking the algorithm to extrapolate from historical invoices/
// expenses trend instead — a product decision, not a mechanical fix. The
// error below is deliberately explicit so the weekly cron's failure log says
// why instead of a bare Postgres "relation does not exist".
async function calculateForecast(tenantId: string): Promise<{
  monthly_income: number
  monthly_expenses: number
  net_monthly: number
  runway_months: number | null
  forecast_data: object
}> {
  void tenantId
  throw new Error(
    'cashflowForecast: cashflow_entries table does not exist — this forecast has never run successfully. ' +
    'See the comment above calculateForecast() before attempting a fix.'
  )
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
        .eq('active', true)

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

          // NOTE for whoever fixes calculateForecast(): this upsert is also
          // stale. cashflow_forecasts has no forecast_data/calculated_at
          // columns — it's structured (projected_inflows/projected_outflows/
          // net_by_week/lowest_point/risk_level/opening_balance/
          // closing_balance/generated_at), not a single JSONB blob. Shape
          // the real fix's output to match before wiring this back up.
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
