import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'
import { autoPromoteToTeamMode } from '@/lib/tenant/mode'

const clockSchema = z.object({
  staffId:      z.string().uuid(),
  eventType:    z.enum(['clock_in', 'clock_out', 'break_start', 'break_end']),
  lat:          z.number().min(-90).max(90).optional(),
  lng:          z.number().min(-180).max(180).optional(),
  locationName: z.string().max(200).optional(),
  deviceId:     z.string().max(100).optional(),
})

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.user_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  let body: z.infer<typeof clockSchema>
  try {
    body = clockSchema.parse(await request.json())
  } catch (e) {
    return NextResponse.json({ error: 'Invalid request', detail: e }, { status: 400 })
  }

  // Verify staff member belongs to this tenant
  const { data: staff } = await supabaseAdmin
    .from('staff')
    .select('id')
    .eq('id', body.staffId)
    .eq('tenant_id', tenantId)
    .single()

  if (!staff) return new NextResponse('Staff not found', { status: 404 })

  const { data, error } = await supabaseAdmin
    .from('clock_events')
    .insert({
      tenant_id:     tenantId,
      staff_id:      body.staffId,
      event_type:    body.eventType,
      lat:           body.lat ?? null,
      lng:           body.lng ?? null,
      location_name: body.locationName ?? null,
      device_id:     body.deviceId ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json(data, { status: 201 })
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.user_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  const url      = new URL(request.url)
  const staffId  = url.searchParams.get('staffId')
  const from     = url.searchParams.get('from')
  const to       = url.searchParams.get('to')

  let query = supabaseAdmin
    .from('clock_events')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(200)

  if (staffId) query = query.eq('staff_id', staffId)
  if (from)    query = query.gte('created_at', from)
  if (to)      query = query.lte('created_at', to)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json(data)
}
