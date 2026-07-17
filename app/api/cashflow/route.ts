import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { generateCashflowForecast, saveCashflowForecast } from '@/lib/intelligence/cashflowForecast'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.app_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  const url     = new URL(request.url)
  const refresh = url.searchParams.get('refresh') === 'true'
  const today   = new Date().toISOString().split('T')[0]

  if (!refresh) {
    const { data: cached } = await supabaseAdmin
      .from('cashflow_forecasts')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('forecast_date', today)
      .maybeSingle()

    if (cached) return NextResponse.json(cached)
  }

  const forecast = await generateCashflowForecast(tenantId)
  await saveCashflowForecast(forecast)

  return NextResponse.json(forecast)
}
