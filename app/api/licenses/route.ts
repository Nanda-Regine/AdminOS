import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'

const createSchema = z.object({
  staffId:            z.string().uuid().optional(),
  licenseType:        z.string().min(1).max(200),
  licenseNumber:      z.string().max(100).optional(),
  issuingBody:        z.string().max(200).optional(),
  issueDate:          z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  expiryDate:         z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  documentId:         z.string().uuid().optional(),
  renewalReminderDays: z.number().int().min(7).max(365).default(60),
})

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.app_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  const url    = new URL(request.url)
  const staffId = url.searchParams.get('staffId')
  const expiringSoon = url.searchParams.get('expiringSoon') === 'true'

  let query = supabaseAdmin
    .from('professional_licenses')
    .select('*, staff:staff(full_name, role)')
    .eq('tenant_id', tenantId)
    .order('expiry_date', { ascending: true, nullsFirst: false })

  if (staffId) query = query.eq('staff_id', staffId)
  if (expiringSoon) {
    const today    = new Date().toISOString().split('T')[0]
    const in60Days = new Date(Date.now() + 60 * 86400000).toISOString().split('T')[0]
    query = query.gte('expiry_date', today).lte('expiry_date', in60Days)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Mark expired licenses
  const today = new Date().toISOString().split('T')[0]
  const enriched = (data ?? []).map(lic => ({
    ...lic,
    is_expired:   lic.expiry_date ? lic.expiry_date < today : false,
    days_to_expiry: lic.expiry_date
      ? Math.round((new Date(lic.expiry_date).getTime() - Date.now()) / 86400000)
      : null,
  }))

  return NextResponse.json(enriched)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.app_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  let body: z.infer<typeof createSchema>
  try { body = createSchema.parse(await request.json()) } catch (e) {
    return NextResponse.json({ error: 'Invalid request', detail: e }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('professional_licenses')
    .insert({
      tenant_id:             tenantId,
      staff_id:              body.staffId            ?? null,
      license_type:          body.licenseType,
      license_number:        body.licenseNumber      ?? null,
      issuing_body:          body.issuingBody        ?? null,
      issue_date:            body.issueDate          ?? null,
      expiry_date:           body.expiryDate         ?? null,
      document_id:           body.documentId         ?? null,
      renewal_reminder_days: body.renewalReminderDays,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Auto-create compliance item if expiry date is set
  if (body.expiryDate) {
    await supabaseAdmin.from('compliance_items').insert({
      tenant_id:           tenantId,
      item_type:           'license_renewal',
      title:               `Renew: ${body.licenseType}`,
      description:         body.issuingBody ? `Issued by ${body.issuingBody}` : null,
      due_date:            new Date(
        new Date(body.expiryDate).getTime() - body.renewalReminderDays * 86400000
      ).toISOString().split('T')[0],
      recurrence:          'annual',
      penalty_description: 'Operating with an expired license may result in penalties or business closure.',
    })
  }

  return NextResponse.json(data, { status: 201 })
}
