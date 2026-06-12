import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'
import { requirePermission } from '@/lib/auth/permissions'
import { writeAuditLog, getClientIp } from '@/lib/security/audit'

const createSchema = z.object({
  staffId:       z.string().uuid(),
  recordType:    z.enum(['verbal_warning','written_warning','final_warning','suspension','dismissal','grievance','hearing']),
  incidentDate:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description:   z.string().min(1).max(5000),
  outcome:       z.string().max(2000).optional(),
  documentsUrl:  z.array(z.string().url()).optional(),
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

  const url     = new URL(request.url)
  const staffId = url.searchParams.get('staffId')

  let query = supabaseAdmin
    .from('disciplinary_records')
    .select('*, staff(full_name, job_title)')
    .eq('tenant_id', tenantId)
    .order('incident_date', { ascending: false })

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

  try { await requirePermission('manage_staff') } catch {
    return new NextResponse('Forbidden', { status: 403 })
  }

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
    .from('disciplinary_records')
    .insert({
      tenant_id:     tenantId,
      staff_id:      body.staffId,
      record_type:   body.recordType,
      incident_date: body.incidentDate,
      description:   body.description,
      outcome:       body.outcome ?? null,
      documents_url: body.documentsUrl ?? null,
      issued_by:     user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await writeAuditLog({
    actor:        user.id,
    action:       'disciplinary.record.created',
    resourceType: 'staff',
    resourceId:   body.staffId,
    ipAddress:    getClientIp(request),
    metadata:     { recordType: body.recordType, tenantId },
  })

  return NextResponse.json(data, { status: 201 })
}
