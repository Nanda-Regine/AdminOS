import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { checkPermission } from '@/lib/auth/permissions'
import { z } from 'zod'

const subscribeSchema = z.object({
  addonSlug:    z.string().min(1).max(100),
  quantity:     z.number().int().positive().default(1),
  billingCycle: z.enum(['monthly','annual']).default('monthly'),
  payfastToken: z.string().optional(),
})

// GET /api/billing/addons — list active add-ons + available catalogue
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.app_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  const [activeAddons, catalogue] = await Promise.all([
    supabaseAdmin
      .from('addon_subscriptions')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('status', 'active'),
    supabaseAdmin
      .from('addon_catalogue')
      .select('*')
      .eq('active', true)
      .order('price_monthly'),
  ])

  return NextResponse.json({
    active:    activeAddons.data ?? [],
    catalogue: catalogue.data    ?? [],
  })
}

// POST /api/billing/addons — subscribe to an add-on
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.app_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  if (!(await checkPermission('manage_billing'))) return new NextResponse('Forbidden', { status: 403 })

  let body: z.infer<typeof subscribeSchema>
  try { body = subscribeSchema.parse(await request.json()) } catch (e) {
    return NextResponse.json({ error: 'Invalid request', detail: e }, { status: 400 })
  }

  // Verify add-on exists in catalogue
  const { data: catalogueItem } = await supabaseAdmin
    .from('addon_catalogue')
    .select('slug, price_monthly, price_annual')
    .eq('slug', body.addonSlug)
    .eq('active', true)
    .single()

  if (!catalogueItem) return NextResponse.json({ error: 'Add-on not found' }, { status: 404 })

  const pricePerUnit = body.billingCycle === 'annual'
    ? (catalogueItem.price_annual ?? catalogueItem.price_monthly * 10)
    : catalogueItem.price_monthly

  const { data, error } = await supabaseAdmin
    .from('addon_subscriptions')
    .upsert({
      tenant_id:     tenantId,
      addon_slug:    body.addonSlug,
      status:        'active',
      quantity:      body.quantity,
      price_per_unit: pricePerUnit,
      billing_cycle: body.billingCycle,
      payfast_token: body.payfastToken ?? null,
      started_at:    new Date().toISOString(),
      expires_at:    null,
    }, { onConflict: 'tenant_id,addon_slug' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data, { status: 201 })
}

// DELETE /api/billing/addons?slug=xxx — cancel an add-on
export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.app_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  if (!(await checkPermission('manage_billing'))) return new NextResponse('Forbidden', { status: 403 })

  const url  = new URL(request.url)
  const slug = url.searchParams.get('slug')
  if (!slug) return NextResponse.json({ error: 'slug param required' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('addon_subscriptions')
    .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('addon_slug', slug)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
