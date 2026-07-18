import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'

const createSchema = z.object({
  serviceId: z.string().uuid().optional(),
  contactId: z.string().uuid().optional(),
  staffId:   z.string().uuid().optional(),
  startAt:   z.string().datetime(),
  endAt:     z.string().datetime(),
  notes:     z.string().max(2000).optional(),
  source:    z.enum(['manual','widget','whatsapp','portal']).default('manual'),
})

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.app_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  const url    = new URL(request.url)
  const from   = url.searchParams.get('from')
  const to     = url.searchParams.get('to')
  const status = url.searchParams.get('status')
  const staffId = url.searchParams.get('staffId')

  // Default to current week if no date range
  const fromDate = from ?? new Date().toISOString()
  const toDate   = to   ?? new Date(Date.now() + 7 * 86400000).toISOString()

  let query = supabaseAdmin
    .from('bookings')
    .select('*, service:booking_services(name, duration_minutes, colour), contact:contacts(name, phone, email), staff:staff(full_name)')
    .eq('tenant_id', tenantId)
    .gte('start_at', fromDate)
    .lte('start_at', toDate)
    .order('start_at')

  if (status)  query = query.eq('status', status)
  if (staffId) query = query.eq('staff_id', staffId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
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

  // Validate times
  const start = new Date(body.startAt)
  const end   = new Date(body.endAt)
  if (end <= start) {
    return NextResponse.json({ error: 'end_at must be after start_at' }, { status: 422 })
  }

  // Check for conflicting bookings in the same slot for the same staff
  if (body.staffId) {
    const { data: conflicts } = await supabaseAdmin
      .from('bookings')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('staff_id', body.staffId)
      .not('status', 'in', '(cancelled,no_show)')
      .lt('start_at', body.endAt)
      .gt('end_at',   body.startAt)
      .limit(1)

    if (conflicts && conflicts.length > 0) {
      return NextResponse.json({ error: 'Time slot conflict for selected staff member' }, { status: 409 })
    }
  }

  const { data, error } = await supabaseAdmin
    .from('bookings')
    .insert({
      tenant_id:  tenantId,
      service_id: body.serviceId ?? null,
      contact_id: body.contactId ?? null,
      staff_id:   body.staffId   ?? null,
      start_at:   body.startAt,
      end_at:     body.endAt,
      status:     'confirmed',
      notes:      body.notes  ?? null,
      source:     body.source,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data, { status: 201 })
}
