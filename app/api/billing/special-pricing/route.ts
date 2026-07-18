import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { checkPermission } from '@/lib/auth/permissions'
import { z } from 'zod'

// Special Pricing Programmes — verified discounts for qualifying businesses
// Discount rates: NPO 50%, Youth/Township/Women 30%, Refugee 60%

const PROGRAMME_DISCOUNTS: Record<string, number> = {
  npo_nonprofit:        50,
  youth_owned:          30,
  township_rural:       30,
  women_owned:          30,
  refugee_entrepreneur: 60,
}

const applySchema = z.object({
  programme:            z.enum(['npo_nonprofit','youth_owned','township_rural','women_owned','refugee_entrepreneur']),
  supportingDocuments:  z.array(z.string().url()).min(1, 'At least one supporting document URL required'),
})

// GET /api/billing/special-pricing — list my applications
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.app_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('special_pricing_applications')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('applied_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const programmes = Object.entries(PROGRAMME_DISCOUNTS).map(([slug, pct]) => ({
    slug,
    discount_pct: pct,
    description: getProgrammeDescription(slug),
  }))

  return NextResponse.json({ applications: data ?? [], available_programmes: programmes })
}

// POST /api/billing/special-pricing — apply for a special pricing programme
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.app_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  if (!(await checkPermission('manage_billing'))) return new NextResponse('Forbidden', { status: 403 })

  let body: z.infer<typeof applySchema>
  try { body = applySchema.parse(await request.json()) } catch (e) {
    return NextResponse.json({ error: 'Invalid request', detail: e }, { status: 400 })
  }

  // Check if already applied or approved
  const { data: existing } = await supabaseAdmin
    .from('special_pricing_applications')
    .select('id, status')
    .eq('tenant_id', tenantId)
    .eq('programme', body.programme)
    .maybeSingle()

  if (existing && ['pending','approved'].includes(existing.status)) {
    return NextResponse.json({ error: 'Application already exists', existing }, { status: 409 })
  }

  const { data, error } = await supabaseAdmin
    .from('special_pricing_applications')
    .upsert({
      tenant_id:            tenantId,
      programme:            body.programme,
      status:               'pending',
      supporting_documents: body.supportingDocuments,
      discount_pct:         null,  // set on approval
      applied_at:           new Date().toISOString(),
      reviewed_at:          null,
      reviewed_by:          null,
    }, { onConflict: 'tenant_id,programme' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({
    application: data,
    message: 'Application submitted. Our team will review within 3 business days and notify you via WhatsApp.',
    expected_discount: `${PROGRAMME_DISCOUNTS[body.programme]}% off your monthly plan`,
  }, { status: 201 })
}

function getProgrammeDescription(slug: string): string {
  switch (slug) {
    case 'npo_nonprofit':        return 'Registered NPO/NPC — provide NPO number or CIPC NPC registration'
    case 'youth_owned':          return 'Youth-owned (18–35 years) — provide SA ID and proof of ownership'
    case 'township_rural':       return 'Township/rural-based business — provide proof of business address'
    case 'women_owned':          return '51%+ women-owned business — provide ownership documentation'
    case 'refugee_entrepreneur': return 'Refugee/asylum-seeker entrepreneur — provide UNHCR registration'
    default:                     return ''
  }
}
