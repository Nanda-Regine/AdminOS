import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'
import { getTenantAddons } from '@/lib/billing/planGates'

const updateSchema = z.object({
  name:             z.string().min(1).max(300).optional(),
  businessType:     z.string().max(100).optional(),
  province:         z.string().max(100).optional(),
  websiteUrl:       z.string().url().optional(),
  registrationNumber: z.string().max(100).optional(),
  vatNumber:        z.string().max(50).optional(),
  preferredLanguage: z.string().max(10).optional(),
  aiLanguage:       z.string().max(10).optional(),
  womenOwned:       z.boolean().optional(),
  youthOwned:       z.boolean().optional(),
  townshipBased:    z.boolean().optional(),
  financialYearEndMonth: z.number().int().min(1).max(12).optional(),
})

// GET /api/tenant/me — full tenant profile for dashboard bootstrap
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.app_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  const [tenantRes, addons, planCatalogueRes, specialPricingRes] = await Promise.all([
    supabaseAdmin
      .from('tenants')
      .select('*')
      .eq('id', tenantId)
      .single(),
    getTenantAddons(tenantId),
    supabaseAdmin
      .from('plan_catalogue')
      .select('slug, display_name, price_monthly, max_staff, max_conversations_monthly, features')
      .eq('active', true)
      .order('price_monthly'),
    supabaseAdmin
      .from('special_pricing_applications')
      .select('programme, status, discount_pct')
      .eq('tenant_id', tenantId)
      .eq('status', 'approved'),
  ])

  if (tenantRes.error) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

  const tenant  = tenantRes.data
  const pricing = specialPricingRes.data?.[0]

  return NextResponse.json({
    tenant,
    plan:            tenant.plan ?? 'solo',
    addons,
    special_pricing: pricing ?? null,
    plan_catalogue:  planCatalogueRes.data ?? [],
    features: {
      // Plan-tier features (included by tier, not sold as add-ons)
      has_payroll:      ['grow','operate','scale','partner'].includes(tenant.plan),
      has_booking:      ['operate','scale','partner'].includes(tenant.plan),
      has_esignature:   ['operate','scale','partner'].includes(tenant.plan),
      has_social_inbox: ['scale','partner'].includes(tenant.plan),
      has_valuation:    ['scale','partner'].includes(tenant.plan),
      has_board_pack:   ['scale','partner'].includes(tenant.plan),
      has_white_label:  tenant.plan === 'partner',
      // Add-on entitlements — canonical five, paid OR bundled by plan
      has_ring:          addons.includes('ring'),
      has_reach:         addons.includes('reach'),
      has_sage:          addons.includes('sage'),
      has_languages:     addons.includes('languages'),
      has_client_portal: addons.includes('client_portal'),
    },
  })
}

// PATCH /api/tenant/me — update tenant settings
export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.app_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  let body: z.infer<typeof updateSchema>
  try { body = updateSchema.parse(await request.json()) } catch (e) {
    return NextResponse.json({ error: 'Invalid request', detail: e }, { status: 400 })
  }

  const updates: Record<string, unknown> = {}
  if (body.name             !== undefined) updates.name              = body.name
  if (body.businessType     !== undefined) updates.business_type     = body.businessType
  if (body.province         !== undefined) updates.province          = body.province
  if (body.websiteUrl       !== undefined) updates.website_url       = body.websiteUrl
  if (body.registrationNumber !== undefined) updates.registration_number = body.registrationNumber
  if (body.vatNumber        !== undefined) updates.vat_number        = body.vatNumber
  if (body.womenOwned       !== undefined) updates.women_owned       = body.womenOwned
  if (body.youthOwned       !== undefined) updates.youth_owned       = body.youthOwned
  if (body.townshipBased    !== undefined) updates.township_based    = body.townshipBased

  // Language settings go into the settings JSONB column
  if (body.preferredLanguage !== undefined || body.aiLanguage !== undefined || body.financialYearEndMonth !== undefined) {
    const { data: current } = await supabaseAdmin.from('tenants').select('settings').eq('id', tenantId).single()
    const currentSettings   = (current?.settings ?? {}) as Record<string, unknown>
    const newSettings       = { ...currentSettings }
    if (body.preferredLanguage !== undefined)  newSettings.preferred_language        = body.preferredLanguage
    if (body.aiLanguage        !== undefined)  newSettings.ai_language               = body.aiLanguage
    if (body.financialYearEndMonth !== undefined) newSettings.financial_year_end_month = body.financialYearEndMonth
    updates.settings = newSettings
  }

  const { data, error } = await supabaseAdmin
    .from('tenants')
    .update(updates)
    .eq('id', tenantId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
