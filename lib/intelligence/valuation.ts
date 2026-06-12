import { supabaseAdmin } from '@/lib/supabase/admin'

// Revenue multiples by sector (SA SME context — conservative)
const REVENUE_MULTIPLES: Record<string, number> = {
  technology:       3.0,
  saas:             5.0,
  professional:     1.5,
  retail:           0.5,
  food_beverage:    0.6,
  construction:     0.8,
  healthcare:       2.0,
  education:        1.8,
  logistics:        1.0,
  manufacturing:    0.9,
  agriculture:      0.7,
  media:            2.5,
  default:          1.2,
}

// EBITDA multiples by sector
const EBITDA_MULTIPLES: Record<string, number> = {
  technology:       8.0,
  saas:             12.0,
  professional:     5.0,
  retail:           4.0,
  food_beverage:    4.5,
  construction:     4.0,
  healthcare:       7.0,
  education:        6.0,
  logistics:        5.0,
  manufacturing:    5.5,
  agriculture:      4.0,
  media:            6.0,
  default:          5.0,
}

export interface ExitReadinessResult {
  score:          number   // 0–100
  teachable:      number   // 0–20: can the product/service be taught in 6 months?
  valuable:       number   // 0–20: is it needed consistently?
  repeatable:     number   // 0–20: consistent delivery?
  scalable:       number   // 0–20: can it grow without proportional effort?
  recurring:      number   // 0–20: recurring revenue?
  warnings:       string[]
}

export interface ValuationResult {
  tenantId:        string
  revenueMultiple: number
  ebitdaMultiple:  number
  revenueTTM:      number
  ebitdaTTM:       number
  revenueValue:    number
  ebitdaValue:     number
  estimatedValue:  number
  exitReadiness:   ExitReadinessResult
  sector:          string
}

async function getRevenueTTM(tenantId: string): Promise<number> {
  const oneYearAgo = new Date(Date.now() - 365 * 86400000).toISOString()
  const { data } = await supabaseAdmin
    .from('invoices')
    .select('total')
    .eq('tenant_id', tenantId)
    .eq('status', 'paid')
    .gte('created_at', oneYearAgo)

  return (data ?? []).reduce((s, inv) => s + (inv.total ?? 0), 0)
}

async function getExitReadiness(tenantId: string): Promise<ExitReadinessResult> {
  const warnings: string[] = []

  const [sopResult, clientResult, healthResult, staffResult] = await Promise.all([
    supabaseAdmin.from('sop_documents').select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId).eq('status', 'active'),
    supabaseAdmin.from('invoices').select('contact_id, total')
      .eq('tenant_id', tenantId).eq('status', 'paid')
      .gte('created_at', new Date(Date.now() - 365 * 86400000).toISOString()),
    supabaseAdmin.from('business_health_snapshots').select('overall_score')
      .eq('tenant_id', tenantId).order('snapshot_date', { ascending: false }).limit(1).single(),
    supabaseAdmin.from('staff').select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId).eq('status', 'active'),
  ])

  const sopCount    = sopResult.count ?? 0
  const staffCount  = staffResult.count ?? 0
  const invoices    = clientResult.data ?? []
  const healthScore = healthResult.data?.overall_score ?? 50

  // Teachable: SOPs documented
  const teachable = Math.min(20, sopCount >= 10 ? 20 : sopCount >= 5 ? 14 : sopCount >= 1 ? 8 : 2)
  if (sopCount < 5) warnings.push('Less than 5 SOPs documented — the business depends on owner knowledge')

  // Valuable: health score as proxy for consistent demand
  const valuable = Math.round((healthScore / 100) * 20)

  // Repeatable: consistent revenue (using invoice regularity)
  const repeatable = invoices.length > 24 ? 18 : invoices.length > 12 ? 14 : invoices.length > 6 ? 10 : 4

  // Scalable: team size indicates capacity to scale
  const scalable = staffCount >= 5 ? 18 : staffCount >= 2 ? 14 : staffCount >= 1 ? 10 : 4
  if (staffCount === 0) warnings.push('No team — owner is the entire business, which dramatically reduces scalability')

  // Recurring: check for clients with 3+ invoices (proxy for repeat business)
  const clientCounts: Record<string, number> = {}
  for (const inv of invoices) {
    if (inv.contact_id) clientCounts[inv.contact_id] = (clientCounts[inv.contact_id] ?? 0) + 1
  }
  const repeatClients = Object.values(clientCounts).filter(c => c >= 3).length
  const recurring = repeatClients >= 5 ? 18 : repeatClients >= 2 ? 12 : repeatClients >= 1 ? 6 : 2

  // Client concentration check
  const totalRevenue = invoices.reduce((s, inv) => s + (inv.total ?? 0), 0)
  for (const [clientId, count] of Object.entries(clientCounts)) {
    const clientRevenue = invoices.filter(i => i.contact_id === clientId).reduce((s, i) => s + (i.total ?? 0), 0)
    if (totalRevenue > 0 && clientRevenue / totalRevenue > 0.2) {
      warnings.push('A single client represents more than 20% of revenue — high concentration risk')
      break
    }
  }

  const score = teachable + valuable + repeatable + scalable + recurring

  return { score, teachable, valuable, repeatable, scalable, recurring, warnings }
}

export async function calculateValuation(tenantId: string): Promise<ValuationResult> {
  // Get tenant sector
  const { data: tenant } = await supabaseAdmin
    .from('tenants')
    .select('business_type')
    .eq('id', tenantId)
    .single()

  const sector       = tenant?.business_type ?? 'default'
  const revMult      = REVENUE_MULTIPLES[sector] ?? REVENUE_MULTIPLES.default
  const ebitdaMult   = EBITDA_MULTIPLES[sector]  ?? EBITDA_MULTIPLES.default

  const revenueTTM   = await getRevenueTTM(tenantId)
  const ebitdaTTM    = revenueTTM * 0.12  // assume 12% EBITDA margin as default; Phase 9 will refine this

  const revenueValue = revenueTTM * revMult
  const ebitdaValue  = ebitdaTTM  * ebitdaMult

  // Weighted average: 60% EBITDA, 40% revenue (or fallback to revenue if EBITDA too low)
  const estimatedValue = ebitdaTTM > 0
    ? (ebitdaValue * 0.6) + (revenueValue * 0.4)
    : revenueValue

  const exitReadiness = await getExitReadiness(tenantId)

  return {
    tenantId,
    revenueMultiple: revMult,
    ebitdaMultiple:  ebitdaMult,
    revenueTTM:      Math.round(revenueTTM),
    ebitdaTTM:       Math.round(ebitdaTTM),
    revenueValue:    Math.round(revenueValue),
    ebitdaValue:     Math.round(ebitdaValue),
    estimatedValue:  Math.round(estimatedValue),
    exitReadiness,
    sector,
  }
}

export async function saveValuationSnapshot(result: ValuationResult): Promise<void> {
  await supabaseAdmin.from('valuation_snapshots').upsert({
    tenant_id:             result.tenantId,
    snapshot_date:         new Date().toISOString().split('T')[0],
    revenue_multiple_value: result.revenueValue,
    revenue_multiple_used:  result.revenueMultiple,
    ebitda_value:           result.ebitdaValue,
    ebitda_multiple_used:   result.ebitdaMultiple,
    estimated_value:        result.estimatedValue,
    exit_score:             result.exitReadiness.score,
    exit_details:           result.exitReadiness,
    sector:                 result.sector,
    revenue_ttm:            result.revenueTTM,
    ebitda_ttm:             result.ebitdaTTM,
  })
}
