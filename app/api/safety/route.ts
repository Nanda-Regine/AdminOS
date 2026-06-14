import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requirePermission } from '@/lib/auth/permissions'
import { z } from 'zod'

const createSchema = z.object({
  staffId:          z.string().uuid().optional(),
  incidentDate:     z.string().datetime(),
  incidentType:     z.enum(['near_miss','minor_injury','major_injury','fatality','property_damage','environmental']),
  description:      z.string().min(10).max(5000),
  location:         z.string().max(300).optional(),
  witnesses:        z.array(z.string()).default([]),
  immediateAction:  z.string().max(2000).optional(),
  rootCause:        z.string().max(2000).optional(),
  correctiveAction: z.string().max(2000).optional(),
  iodReported:      z.boolean().default(false),
  iodReference:     z.string().max(100).optional(),
})

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.user_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  try { await requirePermission('manage_staff') } catch {
    return new NextResponse('Forbidden', { status: 403 })
  }

  const url  = new URL(request.url)
  const type = url.searchParams.get('type')
  const from = url.searchParams.get('from')
  const to   = url.searchParams.get('to')

  let query = supabaseAdmin
    .from('safety_incidents')
    .select('*, staff:staff(full_name, role)')
    .eq('tenant_id', tenantId)
    .order('incident_date', { ascending: false })

  if (type) query = query.eq('incident_type', type)
  if (from) query = query.gte('incident_date', from)
  if (to)   query = query.lte('incident_date', to)

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
  try { body = createSchema.parse(await request.json()) } catch (e) {
    return NextResponse.json({ error: 'Invalid request', detail: e }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('safety_incidents')
    .insert({
      tenant_id:        tenantId,
      staff_id:         body.staffId         ?? null,
      incident_date:    body.incidentDate,
      incident_type:    body.incidentType,
      description:      body.description,
      location:         body.location        ?? null,
      witnesses:        body.witnesses,
      immediate_action: body.immediateAction  ?? null,
      root_cause:       body.rootCause        ?? null,
      corrective_action: body.correctiveAction ?? null,
      iod_reported:     body.iodReported,
      iod_reference:    body.iodReference     ?? null,
      created_by:       user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Major injury or fatality: create a compliance action item
  if (['major_injury','fatality'].includes(body.incidentType)) {
    await supabaseAdmin.from('compliance_items').insert({
      tenant_id:           tenantId,
      item_type:           'coida_report',
      title:               `COIDA IOD Report — ${body.incidentType === 'fatality' ? 'FATALITY' : 'Major Injury'}`,
      description:         `Incident on ${body.incidentDate.split('T')[0]}. IOD must be reported to the Compensation Fund within 7 days.`,
      due_date:            new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      penalty_description: 'Employers failing to report must cover the full cost of compensation themselves.',
    })
  }

  return NextResponse.json(data, { status: 201 })
}
