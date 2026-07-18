import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { DECISION_CATALOGUE, DECISION_DEFAULTS, type Tier } from '@/lib/autonomy/tiers'

// GET  /api/autonomy → the effective tier for every governed decision.
// POST /api/autonomy {domain, decision_type, tier} → set one.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })
  const tenantId = user.app_metadata?.tenant_id as string
  if (!tenantId) return NextResponse.json({ decisions: [] })

  const { data } = await supabaseAdmin
    .from('tenant_autonomy_config')
    .select('domain, decision_type, tier')
    .eq('tenant_id', tenantId)
  const overrides = new Map((data ?? []).map(r => [`${r.domain}/${r.decision_type}`, r.tier as Tier]))

  const decisions = DECISION_CATALOGUE.map(d => {
    const key = `${d.domain}/${d.decision_type}`
    return { ...d, tier: overrides.get(key) ?? DECISION_DEFAULTS[key] ?? 'C' }
  })
  return NextResponse.json({ decisions })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })
  const tenantId = user.app_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  const body = await request.json().catch(() => ({})) as { domain?: string; decision_type?: string; tier?: Tier }
  if (!body.domain || !body.decision_type || !['A', 'B', 'C'].includes(body.tier ?? '')) {
    return NextResponse.json({ error: 'domain, decision_type, tier(A|B|C) required' }, { status: 400 })
  }
  // Guard: final_demand can never be set to auto (legal boundary).
  if (body.domain === 'money' && body.decision_type === 'final_demand' && body.tier === 'A') {
    return NextResponse.json({ error: 'Final demands must be sent by you — auto-send is not permitted.' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('tenant_autonomy_config')
    .upsert({ tenant_id: tenantId, domain: body.domain, decision_type: body.decision_type, tier: body.tier, updated_at: new Date().toISOString() }, { onConflict: 'tenant_id,domain,decision_type' })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
