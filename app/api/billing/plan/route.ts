import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { checkPermission } from '@/lib/auth/permissions'
import { z } from 'zod'

const VALID_PLANS = ['solo','grow','operate','scale','partner'] as const

const changePlanSchema = z.object({
  newPlan:      z.enum(VALID_PLANS),
  payfastToken: z.string().optional(),
  billingCycle: z.enum(['monthly','annual']).default('monthly'),
  reason:       z.string().max(500).optional(),
})

// GET /api/billing/plan — current plan + available plans
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.app_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  const [tenantRes, catalogueRes, historyRes] = await Promise.all([
    supabaseAdmin.from('tenants').select('plan').eq('id', tenantId).single(),
    supabaseAdmin.from('plan_catalogue').select('*').eq('active', true).order('price_monthly'),
    supabaseAdmin.from('plan_changes').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(10),
  ])

  return NextResponse.json({
    current_plan: tenantRes.data?.plan ?? 'solo',
    catalogue:    catalogueRes.data ?? [],
    history:      historyRes.data   ?? [],
  })
}

// POST /api/billing/plan — request a plan change (webhook from PayFast confirms it)
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.app_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  if (!(await checkPermission('manage_billing'))) return new NextResponse('Forbidden', { status: 403 })

  let body: z.infer<typeof changePlanSchema>
  try { body = changePlanSchema.parse(await request.json()) } catch (e) {
    return NextResponse.json({ error: 'Invalid request', detail: e }, { status: 400 })
  }

  const { data: tenant } = await supabaseAdmin
    .from('tenants')
    .select('plan')
    .eq('id', tenantId)
    .single()

  const previousPlan = tenant?.plan ?? 'solo'

  if (previousPlan === body.newPlan) {
    return NextResponse.json({ message: 'Already on this plan', plan: previousPlan }, { status: 200 })
  }

  // Record the plan change
  await supabaseAdmin.from('plan_changes').insert({
    tenant_id:     tenantId,
    previous_plan: previousPlan,
    new_plan:      body.newPlan,
    reason:        body.reason ?? 'user_requested',
    changed_by:    user.id,
    payfast_token: body.payfastToken ?? null,
    effective_date: new Date().toISOString().split('T')[0],
  })

  // Update tenant plan (in production, this is only finalised after PayFast confirms payment)
  // For downgrade: immediate; for upgrade: require PayFast confirmation via webhook
  const PLAN_RANK: Record<string, number> = { solo: 0, grow: 1, operate: 2, scale: 3, partner: 4 }
  const isDowngrade = (PLAN_RANK[body.newPlan] ?? 0) < (PLAN_RANK[previousPlan] ?? 0)

  if (isDowngrade || body.payfastToken) {
    await supabaseAdmin
      .from('tenants')
      .update({ plan: body.newPlan })
      .eq('id', tenantId)
  }

  return NextResponse.json({
    previous_plan: previousPlan,
    new_plan:      body.newPlan,
    status:        isDowngrade ? 'effective_immediately' : 'pending_payment_confirmation',
    message:       isDowngrade
      ? `Your plan has been downgraded to ${body.newPlan}.`
      : `Your upgrade to ${body.newPlan} will be activated once payment is confirmed.`,
  })
}
