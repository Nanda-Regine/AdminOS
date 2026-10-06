import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { checkRateLimit } from '@/lib/security/rateLimit'
import { z } from 'zod'
import { upsertContact } from '@/lib/contacts/upsert'
import { validatePhone } from '@/lib/integrations/phone'

const bookingSchema = z.object({
  serviceId:    z.string().uuid(),
  staffId:      z.string().uuid().optional(),
  startAt:      z.string().datetime(),
  endAt:        z.string().datetime(),
  contactName:  z.string().min(1).max(200),
  contactPhone: z.string().min(1).max(30),
  contactEmail: z.string().email().optional(),
  notes:        z.string().max(2000).optional(),
})

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  // Resolve tenant by slug (there is no booking_slug / logo_url column).
  const { data: tenant, error: tenantError } = await supabaseAdmin
    .from('tenants')
    .select('id, name')
    .eq('slug', slug)
    .single()

  if (tenantError || !tenant) {
    return NextResponse.json({ error: 'Booking page not found' }, { status: 404 })
  }

  // Fetch active services
  const { data: services, error: servicesError } = await supabaseAdmin
    .from('booking_services')
    .select('id, name, duration_minutes, price, colour').is('deleted_at', null)
    .eq('tenant_id', tenant.id)
    .eq('active', true)
    .order('name')

  if (servicesError) return NextResponse.json({ error: 'Could not load services' }, { status: 500 })

  return NextResponse.json({
    tenant: {
      name: tenant.name,
    },
    services: services ?? [],
  })
}

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  // Public booking form — rate-limit per page + caller IP to stop booking spam.
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const { success } = await checkRateLimit('api', `book:${slug}:${ip}`)
  if (!success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  // Resolve tenant by slug
  const { data: tenant, error: tenantError } = await supabaseAdmin
    .from('tenants')
    .select('id')
    .eq('slug', slug)
    .single()

  if (tenantError || !tenant) {
    return NextResponse.json({ error: 'Booking page not found' }, { status: 404 })
  }

  const tenantId = tenant.id

  let body: z.infer<typeof bookingSchema>
  try { body = bookingSchema.parse(await request.json()) } catch (e) {
    void e
    return NextResponse.json({ error: 'Please check the booking details and try again' }, { status: 400 })
  }

  if (!validatePhone(body.contactPhone).valid) {
    return NextResponse.json({ error: 'Please enter a valid phone number' }, { status: 422 })
  }

  // Validate time range
  const start = new Date(body.startAt)
  const end   = new Date(body.endAt)
  if (end <= start) {
    return NextResponse.json({ error: 'end_at must be after start_at' }, { status: 422 })
  }

  // Verify service belongs to this tenant
  const { data: service } = await supabaseAdmin
    .from('booking_services')
    .select('id').is('deleted_at', null)
    .eq('id', body.serviceId)
    .eq('tenant_id', tenantId)
    .eq('active', true)
    .single()

  if (!service) {
    return NextResponse.json({ error: 'Service not found' }, { status: 404 })
  }

  // A staff id from a public form is untrusted: it must be a live member of
  // THIS business, or anyone could attach bookings to another tenant's staff.
  if (body.staffId) {
    const { data: staff } = await supabaseAdmin
      .from('staff')
      .select('id').is('deleted_at', null)
      .eq('id', body.staffId)
      .eq('tenant_id', tenantId)
      .maybeSingle()
    if (!staff) return NextResponse.json({ error: 'That staff member is not available' }, { status: 404 })
  }

  // Find-or-create the customer. (Was a contacts upsert writing a 'name' column
  // that doesn't exist, against a DEFERRABLE unique key Postgres won't use as
  // an ON CONFLICT arbiter — every public booking failed. See lib/contacts/upsert.)
  let contactId: string
  try {
    contactId = await upsertContact({
      tenantId,
      phone:    body.contactPhone,
      fullName: body.contactName,
      email:    body.contactEmail ?? null,
      source:   'booking_page',
    })
  } catch (e) {
    console.error('[book] contact upsert failed', e)
    return NextResponse.json({ error: 'Could not save your details — please try again' }, { status: 500 })
  }

  // Check for staff conflicts if staffId provided
  if (body.staffId) {
    const { data: conflicts } = await supabaseAdmin
      .from('bookings')
      .select('id').is('deleted_at', null)
      .eq('tenant_id', tenantId)
      .eq('staff_id', body.staffId)
      .not('status', 'in', '(cancelled,no_show)')
      .lt('start_at', body.endAt)
      .gt('end_at', body.startAt)
      .limit(1)

    if (conflicts && conflicts.length > 0) {
      return NextResponse.json({ error: 'Time slot not available' }, { status: 409 })
    }
  }

  // Create booking
  const { data: booking, error: bookingError } = await supabaseAdmin
    .from('bookings')
    .insert({
      tenant_id:  tenantId,
      service_id: body.serviceId,
      contact_id: contactId,
      staff_id:   body.staffId ?? null,
      start_at:   body.startAt,
      end_at:     body.endAt,
      status:     'confirmed',
      notes:      body.notes ?? null,
      source:     'widget',
    })
    .select()
    .single()

  if (bookingError) {
    console.error('[book] booking insert failed', bookingError)
    return NextResponse.json({ error: 'Could not confirm the booking — please try again' }, { status: 500 })
  }

  return NextResponse.json(
    {
      success:   true,
      booking_id: booking.id,
      start_at:   booking.start_at,
      end_at:     booking.end_at,
      status:     booking.status,
    },
    { status: 201 }
  )
}
