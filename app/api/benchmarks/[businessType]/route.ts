import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

// GET /api/benchmarks/[businessType]
// Returns anonymised sector benchmarks for a business type
// Tenants see how their metrics compare to peers (p25/p50/p75)

export async function GET(request: Request, { params }: { params: Promise<{ businessType: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.app_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  const { businessType } = await params

  // Fetch benchmark data for this business type
  const { data: benchmarks, error } = await supabaseAdmin
    .from('sector_benchmarks')
    .select('metric_name, value_p25, value_p50, value_p75, sample_size, calculated_at')
    .eq('business_type', businessType)
    .order('metric_name')

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  if (!benchmarks || benchmarks.length === 0) {
    return NextResponse.json({
      business_type: businessType,
      benchmarks:    [],
      message:       'No benchmark data available yet for this business type. Data is collected from anonymised peer activity.',
    })
  }

  // Fetch this tenant's own annual revenue for comparison
  const oneYearAgo = new Date(Date.now() - 365 * 86400000).toISOString()
  const { data: revenueData } = await supabaseAdmin
    .from('invoices')
    .select('total')
    .eq('tenant_id', tenantId)
    .eq('status', 'paid')
    .gte('created_at', oneYearAgo)

  const myRevenue = (revenueData ?? []).reduce((sum, inv) => sum + Number(inv.total ?? 0), 0)

  // Compute tenant's percentile position
  const revBenchmark = benchmarks.find(b => b.metric_name === 'annual_revenue_zar')
  let myPercentile: string | null = null

  if (revBenchmark && myRevenue > 0) {
    if (myRevenue < revBenchmark.value_p25)      myPercentile = 'bottom_25'
    else if (myRevenue < revBenchmark.value_p50) myPercentile = 'p25_to_p50'
    else if (myRevenue < revBenchmark.value_p75) myPercentile = 'p50_to_p75'
    else                                          myPercentile = 'top_25'
  }

  return NextResponse.json({
    business_type:   businessType,
    benchmarks,
    my_metrics: {
      annual_revenue_zar: myRevenue,
      percentile_band:    myPercentile,
    },
    note: 'Benchmark data is anonymised and aggregated from a minimum of 3 businesses in the same sector.',
  })
}
