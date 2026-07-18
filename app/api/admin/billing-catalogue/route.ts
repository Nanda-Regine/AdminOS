import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireSuperAdmin } from '@/lib/auth/context'
import { writeAuditLog, getClientIp } from '@/lib/security/audit'
import { ADDON_SLUGS } from '@/lib/billing/addons'
import { z } from 'zod'

// Operator-only editor for the billing catalogue — the single source of truth for
// plan/add-on prices and the bundling ladder. Prices are data, not code: editing
// here changes what checkout charges intent, what the billing page shows, and
// which add-ons a plan bundles, with no deploy.
//
// NOTE: the AMOUNT actually charged for a recurring subscription lives in the
// Paystack plan on the Mirembe hub. Changing price_monthly here updates display
// and intent; the matching Paystack plan must be updated hub-side to match. The
// GET response flags any add-on whose live Paystack plan code env is missing.

export async function GET() {
  const admin = await requireSuperAdmin()
  if (!admin) return new NextResponse('Forbidden', { status: 403 })

  const [plansRes, addonsRes] = await Promise.all([
    supabaseAdmin.from('plan_catalogue')
      .select('slug, display_name, price_monthly, price_annual, included_addons, active')
      .order('price_monthly'),
    supabaseAdmin.from('addon_catalogue')
      .select('slug, display_name, description, price_monthly, price_annual, active')
      .order('price_monthly'),
  ])

  // Which add-ons have a live Paystack plan code configured (chargeable).
  const paystackConfigured = Object.fromEntries(
    ADDON_SLUGS.map(s => [s, !!process.env[`PAYSTACK_PLAN_ADMINOS_${s.toUpperCase()}`]]),
  )

  return NextResponse.json({
    plans:  plansRes.data ?? [],
    addons: addonsRes.data ?? [],
    addonSlugs: ADDON_SLUGS,
    paystackConfigured,
  })
}

const planPatch = z.object({
  type: z.literal('plan'),
  slug: z.string().min(1),
  price_monthly:   z.number().nonnegative().optional(),
  price_annual:    z.number().nonnegative().nullable().optional(),
  included_addons: z.array(z.enum(ADDON_SLUGS)).optional(),
  active:          z.boolean().optional(),
})
const addonPatch = z.object({
  type: z.literal('addon'),
  slug: z.enum(ADDON_SLUGS),
  display_name:  z.string().min(1).max(120).optional(),
  description:   z.string().max(500).optional(),
  price_monthly: z.number().nonnegative().optional(),
  price_annual:  z.number().nonnegative().nullable().optional(),
  active:        z.boolean().optional(),
})
const patchSchema = z.discriminatedUnion('type', [planPatch, addonPatch])

export async function PATCH(request: Request) {
  const admin = await requireSuperAdmin()
  if (!admin) return new NextResponse('Forbidden', { status: 403 })

  let body: z.infer<typeof patchSchema>
  try { body = patchSchema.parse(await request.json()) } catch (e) {
    return NextResponse.json({ error: 'Invalid request', detail: e }, { status: 400 })
  }

  const { type, slug, ...fields } = body
  const table = type === 'plan' ? 'plan_catalogue' : 'addon_catalogue'
  const updates = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined))
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin.from(table).update(updates).eq('slug', slug).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await writeAuditLog({
    actor: admin.id,
    action: 'admin.billing_catalogue.updated',
    resourceType: table,
    resourceId: slug,
    ipAddress: getClientIp(request),
    metadata: { updates },
    critical: true,   // pricing change — must be attributable
  })

  return NextResponse.json(data)
}
