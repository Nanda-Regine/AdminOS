import { inngest } from '@/inngest/client'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { fetchAll } from '@/lib/supabase/fetchAll'
import { generateCashflowForecast, saveCashflowForecast } from '@/lib/intelligence/cashflowForecast'

// Weekly 90-day cashflow forecast for every active tenant, so Monday's Cash
// Cockpit, board pack and Langa all read a fresh forecast without anyone
// having to open /dashboard/cashflow first.
//
// History: this function used to compute its own forecast from a
// `cashflow_entries` table that never existed, and was stubbed to throw on
// every run (it never succeeded once). The real engine — open invoices × a
// payment-probability curve, unpaid expenses, payroll — already lived in
// lib/intelligence/cashflowForecast.ts behind GET /api/cashflow. Session 20
// pointed the cron at it instead of keeping two forecasting models.
export const cashflowForecastFunction = inngest.createFunction(
  { id: 'cashflow-forecast-weekly', retries: 2, triggers: [{ cron: '0 6 * * 1' }] },
  async ({ step }: any) => {
    const tenants = await step.run('get-active-tenants', async () => {
      return fetchAll<{ id: string }>((from, to) =>
        supabaseAdmin.from('tenants').select('id').eq('active', true).order('id').range(from, to))
    })

    if (tenants.length === 0) return { processed: 0 }

    let processed = 0
    let failed = 0
    const errors: string[] = []

    // One step per tenant: a failure in one business never blocks the rest,
    // and Inngest retries only the tenant that failed.
    for (const tenant of tenants) {
      // eslint-disable-next-line no-await-in-loop
      const result = await step.run(`forecast-${tenant.id}`, async () => {
        try {
          const forecast = await generateCashflowForecast(tenant.id)
          await saveCashflowForecast(forecast)
          return { status: 'ok' as const, risk: forecast.riskLevel }
        } catch (err) {
          return { status: 'error' as const, error: String(err) }
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
