import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getTenantAddons } from '@/lib/billing/planGates'
import { guard } from '@/lib/api/guard'

// GET /api/tenant/me — full tenant profile for dashboard bootstrap
export async function GET(request: Request) {
  const gate = await guard('settings.read'); if (gate.denied) return gate.denied
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
      has_languages:     addons.includes('languages'),
      has_client_portal: addons.includes('client_portal'),
    },
  })
}

// No PATCH here (removed Session 20): it had no caller and wrote six columns
// tenants does not have (province, website_url, registration_number,
// vat_number, women/youth/township flags). The business profile is edited
// through POST /api/settings/profile, which validates and audits it.
