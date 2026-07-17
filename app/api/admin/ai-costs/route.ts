import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { Redis } from '@upstash/redis'
import { budgetKey, getDailyTokenLimit, usdToZar } from '@/lib/ai/costControls'
import { requireSuperAdmin } from '@/lib/auth/context'

const redis = new Redis({
  url:   process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

export async function GET(request: Request) {
  const admin = await requireSuperAdmin()
  if (!admin) return new NextResponse('Forbidden', { status: 403 })

  const url    = new URL(request.url)
  const days   = Math.min(parseInt(url.searchParams.get('days') ?? '30'), 90)
  const from   = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  // Top tenants by cost (last N days)
  const { data: topTenants } = await supabaseAdmin
    .from('ai_usage_logs')
    .select(`
      tenant_id,
      tenants(name, plan),
      cost_usd.sum(),
      tokens_in.sum(),
      tokens_out.sum()
    `)
    .gte('created_at', from)
    .order('cost_usd.sum()', { ascending: false })
    .limit(20)

  // Feature breakdown (last N days)
  const { data: byFeature } = await supabaseAdmin
    .from('ai_usage_logs')
    .select(`
      feature,
      cost_usd.sum(),
      tokens_in.sum(),
      tokens_out.sum()
    `)
    .gte('created_at', from)
    .order('cost_usd.sum()', { ascending: false })

  // Total cost
  const { data: totals } = await supabaseAdmin
    .from('ai_usage_logs')
    .select('cost_usd.sum(), tokens_in.sum(), tokens_out.sum()')
    .gte('created_at', from)
    .single()

  // Abuse flags (currently active)
  const { data: tenants } = await supabaseAdmin
    .from('tenants')
    .select('id, name, plan')

  const abuseChecks = await Promise.all(
    (tenants ?? []).map(async (t) => {
      const flag = await redis.get<string>(`ai:abuse:flag:${t.id}`)
      return flag ? { id: t.id, name: t.name, plan: t.plan } : null
    })
  )
  const abusedTenants = abuseChecks.filter(Boolean)

  // Today's live budget usage for top 10 tenants
  const topTenantIds = (topTenants ?? []).slice(0, 10).map((t) => t.tenant_id)
  const liveBudgets = await Promise.all(
    topTenantIds.map(async (tenantId) => {
      const tenant = (tenants ?? []).find((t) => t.id === tenantId)
      const used   = (await redis.get<number>(budgetKey(tenantId))) ?? 0
      const limit  = getDailyTokenLimit(tenant?.plan ?? 'trial')
      return { tenantId, used, limit, pct: Math.round((used / limit) * 100) }
    })
  )

  const totalCostUsd = (totals as Record<string, number> | null)?.['cost_usd'] ?? 0

  return NextResponse.json({
    period_days:    days,
    total_cost_usd: totalCostUsd,
    total_cost_zar: usdToZar(totalCostUsd),
    top_tenants:    topTenants ?? [],
    by_feature:     byFeature  ?? [],
    abused_tenants: abusedTenants,
    live_budgets:   liveBudgets,
  })
}

// PATCH — super-admin override for a tenant's daily budget
export async function PATCH(request: Request) {
  const admin = await requireSuperAdmin()
  if (!admin) return new NextResponse('Forbidden', { status: 403 })

  const { tenantId, budgetOverride, clearAbuseFlag } = await request.json() as {
    tenantId:       string
    budgetOverride?: number
    clearAbuseFlag?: boolean
  }

  if (!tenantId) return NextResponse.json({ error: 'tenantId required' }, { status: 400 })

  if (clearAbuseFlag) {
    await redis.del(`ai:abuse:flag:${tenantId}`)
  }

  if (budgetOverride !== undefined) {
    await supabaseAdmin
      .from('ai_cost_budgets')
      .upsert({ tenant_id: tenantId, budget_override: budgetOverride, plan: 'override' })
  }

  return NextResponse.json({ ok: true })
}
