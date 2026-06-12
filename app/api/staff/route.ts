import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'
import { requirePermission } from '@/lib/auth/permissions'
import { autoPromoteToTeamMode } from '@/lib/tenant/mode'
import { assignRole } from '@/lib/auth/permissions'
import { writeAuditLog, getClientIp } from '@/lib/security/audit'

const createSchema = z.object({
  fullName:             z.string().min(1).max(200),
  email:                z.string().email().optional(),
  phone:                z.string().max(30).optional(),
  jobTitle:             z.string().max(200).optional(),
  role:                 z.enum(['admin','manager','staff','field_agent']).default('staff'),
  employmentType:       z.enum(['full_time','part_time','contract','casual','intern']).default('full_time'),
  startDate:            z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  salary:               z.number().positive().optional(),
  idNumber:             z.string().max(30).optional(),
  emergencyContactName:  z.string().max(200).optional(),
  emergencyContactPhone: z.string().max(30).optional(),
})

export async function GET(_request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.user_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('staff')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('full_name', { ascending: true })

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

  const { data, error } = await supabaseAdmin
    .from('staff')
    .insert({
      tenant_id:              tenantId,
      full_name:              body.fullName,
      email:                  body.email             ?? null,
      phone:                  body.phone             ?? null,
      job_title:              body.jobTitle           ?? null,
      role:                   body.role,
      employment_type:        body.employmentType,
      start_date:             body.startDate          ?? null,
      salary:                 body.salary             ?? null,
      id_number:              body.idNumber           ?? null,
      emergency_contact_name:  body.emergencyContactName  ?? null,
      emergency_contact_phone: body.emergencyContactPhone ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // First staff member added — auto-promote tenant to team mode
  await autoPromoteToTeamMode(tenantId)

  // If the staff member has a linked user account, assign their role
  if (data.user_id) {
    await assignRole({
      userId:    data.user_id,
      tenantId,
      roleName:  body.role as 'admin' | 'manager' | 'staff' | 'field_agent',
      assignedBy: user.id,
    }).catch(() => null) // non-fatal
  }

  await writeAuditLog({
    actor:        user.id,
    action:       'staff.created',
    resourceType: 'staff',
    resourceId:   data.id,
    ipAddress:    getClientIp(request),
    metadata:     { tenantId, role: body.role },
  })

  return NextResponse.json(data, { status: 201 })
}
