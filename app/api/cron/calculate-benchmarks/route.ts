import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

// GET /api/cron/calculate-benchmarks
// Calculates anonymous sector benchmarks from aggregated tenant data
// Called weekly via Vercel cron (vercel.json)

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  // Get all unique business types
  const { data: types } = await supabaseAdmin
    .from('tenants')
    .select('business_type')
    .not('business_type', 'is', null)

  const businessTypes = [...new Set((types ?? []).map(t => t.business_type).filter(Boolean))]

  let benchmarked = 0

  for (const businessType of businessTypes) {
    // Revenue benchmarks from invoices
    const { data: revenueData } = await supabaseAdmin
      .from('invoices')
      .select('total, tenant_id, tenants!inner(business_type)')
      .eq('tenants.business_type', businessType)
      .eq('status', 'paid')
      .gte('created_at', new Date(Date.now() - 365 * 86400000).toISOString())

    if (!revenueData || revenueData.length < 3) continue  // Need at least 3 tenants for anonymity

    // Group by tenant and sum revenue
    const byTenant: Record<string, number> = {}
    for (const inv of revenueData) {
      byTenant[inv.tenant_id] = (byTenant[inv.tenant_id] ?? 0) + (inv.total ?? 0)
    }

    const revenues = Object.values(byTenant).sort((a, b) => a - b)
    const len = revenues.length

    const p25 = revenues[Math.floor(len * 0.25)]
    const p50 = revenues[Math.floor(len * 0.50)]
    const p75 = revenues[Math.floor(len * 0.75)]

    await supabaseAdmin
      .from('sector_benchmarks')
      .upsert({
        business_type:  businessType,
        metric_name:    'annual_revenue_zar',
        value_p25:      p25,
        value_p50:      p50,
        value_p75:      p75,
        sample_size:    revenues.length,
        calculated_at:  new Date().toISOString(),
      }, { onConflict: 'business_type,metric_name' })

    benchmarked++
  }

  return NextResponse.json({ benchmarked, types_processed: businessTypes.length })
}
