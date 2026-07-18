import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getEffectiveAddons } from '@/lib/billing/addons'

// GET /api/billing/addons — the add-on catalogue plus what this tenant is
// entitled to (paid or bundled by plan).
//
// There is deliberately no POST/DELETE here. Add-ons are PAID for through the
// Paystack checkout (/api/billing/checkout?addon=<slug>) and cancelled via
// /api/billing/addons/cancel. The old POST wrote an `addon_subscriptions` row
// with status='active' and NO payment — a free-activation hole — and that table
// has been removed. Entitlement now lives only in subscriptions.addon_* (set by
// the verified webhook) and the plan bundle. Do not reintroduce a self-serve
// activation path that bypasses payment.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.app_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  const [catalogueRes, entitled] = await Promise.all([
    supabaseAdmin
      .from('addon_catalogue')
      .select('slug, display_name, description, price_monthly, price_annual')
      .eq('active', true)
      .order('price_monthly'),
    getEffectiveAddons(tenantId),
  ])

  return NextResponse.json({
    catalogue: catalogueRes.data ?? [],
    entitled,   // slugs the tenant already has (paid or via plan bundle)
  })
}
