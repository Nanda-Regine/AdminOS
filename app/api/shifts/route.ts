import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'

const createSchema = z.object({
  staffId:   z.string().uuid(),
  shiftDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime:   z.string().regex(/^\d{2}:\d{2}$/),
  location:  z.string().max(200).optional(),
  notes:     z.string().max(500).optional(),
})

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.user_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  const url      = new URL(request.url)
  const from     = url.searchParams.get('from')
  const to       = url.searchParams.get('to')
  const staffId  = url.searchParams.get('staffId')

  let query = supabaseAdmin
    .from('shifts')
    .select('*, staff(full_name, job_title)')
    .eq('tenant_id', tenantId)
    .order('shift_date', { ascending: true })
    .order('start_time', { ascending: true })

  if (from)    query = query.gte('shift_date', from)
  if (to)      query = query.lte('shift_date', to)
  if (staffId) query = query.eq('staff_id', staffId)

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

  let body: z.infer<typeof createSchema>
  try {
    body = createSchema.parse(await request.json())
  } catch (e) {
    return NextResponse.json({ error: 'Invalid request', detail: e }, { status: 400 })
  }

  const { data: staff } = await supabaseAdmin
    .from('staff')
    .select('id')
    .eq('id', body.staffId)
    .eq('tenant_id', tenantId)
    .single()

  if (!staff) return new NextResponse('Staff not found', { status: 404 })

  const { data, error } = await supabaseAdmin
    .from('shifts')
    .insert({
      tenant_id:  tenantId,
      staff_id:   body.staffId,
      shift_date: body.shiftDate,
      start_time: body.startTime,
      end_time:   body.endTime,
      location:   body.location ?? null,
      notes:      body.notes ?? null,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json(data, { status: 201 })
}
