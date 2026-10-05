import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { generateCashflowForecast, saveCashflowForecast } from '@/lib/intelligence/cashflowForecast'
import { withRoute, unwrap } from '@/lib/api/withRoute'

// GET /api/cashflow[?refresh=true] — today's 90-day forecast (cached per day).
// Was open to any logged-in member of the tenant; cash position is financials.
export const GET = withRoute({
  action: 'money.read',
  query: z.object({ refresh: z.enum(['true', 'false']).optional() }),
}, async ({ ctx, query }) => {
  const today = new Date().toISOString().split('T')[0]

  if (query.refresh !== 'true') {
    const cached = unwrap(await supabaseAdmin
      .from('cashflow_forecasts')
      .select('*')
      .eq('tenant_id', ctx.tenantId)
      .eq('forecast_date', today)
      .maybeSingle())
    if (cached) return cached
  }

  const forecast = await generateCashflowForecast(ctx.tenantId)
  await saveCashflowForecast(forecast)
  return forecast
})
