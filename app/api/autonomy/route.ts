import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { DECISION_CATALOGUE, DECISION_DEFAULTS, type Tier } from '@/lib/autonomy/tiers'
import { withRoute, unwrap, badRequest } from '@/lib/api/withRoute'

// GET  /api/autonomy → the effective tier for every governed decision.
// POST /api/autonomy {domain, decision_type, tier} → set one.
//
// Session 20 (sixth sitting): any domain/decision_type string was accepted
// and stored (only the catalogue's are ever read), and tier changes — which
// decide what AdminOS does without asking — weren't audited.

export const GET = withRoute({ action: 'settings.read' }, async ({ ctx }) => {
  const data = unwrap(await supabaseAdmin
    .from('tenant_autonomy_config')
    .select('domain, decision_type, tier')
    .eq('tenant_id', ctx.tenantId)) ?? []
  const overrides = new Map(data.map(r => [`${r.domain}/${r.decision_type}`, r.tier as Tier]))
  const decisions = DECISION_CATALOGUE.map(d => {
    const key = `${d.domain}/${d.decision_type}`
    return { ...d, tier: overrides.get(key) ?? DECISION_DEFAULTS[key] ?? 'C' }
  })
  return { decisions }
})

const KNOWN = new Set(DECISION_CATALOGUE.map(d => `${d.domain}/${d.decision_type}`))

const schema = z.object({
  domain:        z.string().max(40),
  decision_type: z.string().max(60),
  tier:          z.enum(['A', 'B', 'C']),
}).refine(b => KNOWN.has(`${b.domain}/${b.decision_type}`), { message: 'Unknown decision', path: ['decision_type'] })

export const POST = withRoute({
  action: 'settings.write',
  body: schema,
  resourceType: 'autonomy_config',
}, async ({ ctx, body, audit }) => {
  // Legal boundary: a final demand is always sent by the owner.
  if (body.domain === 'money' && body.decision_type === 'final_demand' && body.tier === 'A') {
    throw badRequest('Final demands must be sent by you — auto-send is not permitted.')
  }
  unwrap(await supabaseAdmin
    .from('tenant_autonomy_config')
    .upsert({ tenant_id: ctx.tenantId, domain: body.domain, decision_type: body.decision_type, tier: body.tier, updated_at: new Date().toISOString() },
      { onConflict: 'tenant_id,domain,decision_type' }))
  await audit({ action: 'autonomy.tier_changed', resourceType: 'autonomy_config', metadata: { decision: `${body.domain}/${body.decision_type}`, tier: body.tier } })
  return { ok: true }
})
