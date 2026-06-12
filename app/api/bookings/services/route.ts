import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'

const serviceSchema = z.object({
  name:               z.string().min(1).max(300),
  description:        z.string().max(2000).optional(),
  durationMinutes:    z.number().int().positive(),
  price:              z.number().nonnegative().optional(),
  bufferMinutes:      z.number().int().nonnegative().default(0),
  maxBookingsPerSlot: z.number().int().positive().default(1),
  staffIds:           z.array(z.string().uuid()).default([]),
  colour:             z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#3B82F6'),
})

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.user_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  const url    = new URL(request.url)
  const active = url.searchParams.get('active')

  let query = supabaseAdmin
    .from('booking_services')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('name')

  if (active !== null) query = query.eq('active', active === 'true')

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.user_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  let body: z.infer<typeof serviceSchema>
  try { body = serviceSchema.parse(await request.json()) } catch (e) {
    return NextResponse.json({ error: 'Invalid request', detail: e }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('booking_services')
    .insert({
      tenant_id:            tenantId,
      name:                 body.name,
      description:          body.description        ?? null,
      duration_minutes:     body.durationMinutes,
      price:                body.price              ?? null,
      buffer_minutes:       body.bufferMinutes,
      max_bookings_per_slot: body.maxBookingsPerSlot,
      staff_ids:            body.staffIds,
      colour:               body.colour,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data, { status: 201 })
}
