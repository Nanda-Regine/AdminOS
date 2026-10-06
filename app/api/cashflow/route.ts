import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { generateCashflowForecast, saveCashflowForecast, type CashflowForecast } from '@/lib/intelligence/cashflowForecast'
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
      .select('tenant_id, forecast_date, opening_balance, closing_balance, projected_inflows, projected_outflows, net_by_week, lowest_point, lowest_point_date, risk_level')
      .eq('tenant_id', ctx.tenantId)
      .eq('forecast_date', today)
      .maybeSingle())
    // Same shape as a fresh forecast. The cache used to return the raw
    // snake_case row, so callers saw `projectedInflows` on a miss and
    // `projected_inflows` on a hit.
    if (cached) {
      const forecast: CashflowForecast = {
        tenantId:          cached.tenant_id,
        forecastDate:      cached.forecast_date,
        openingBalance:    Number(cached.opening_balance ?? 0),
        closingBalance:    Number(cached.closing_balance ?? 0),
        projectedInflows:  cached.projected_inflows ?? [],
        projectedOutflows: cached.projected_outflows ?? [],
        netByWeek:         cached.net_by_week ?? [],
        lowestPoint:       Number(cached.lowest_point ?? 0),
        lowestPointDate:   cached.lowest_point_date ?? today,
        riskLevel:         (cached.risk_level ?? 'safe') as CashflowForecast['riskLevel'],
      }
      return forecast
    }
  }

  const forecast = await generateCashflowForecast(ctx.tenantId)
  await saveCashflowForecast(forecast)
  return forecast
})
