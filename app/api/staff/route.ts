import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'
import { autoPromoteToTeamMode } from '@/lib/tenant/mode'
import { withRoute, unwrap } from '@/lib/api/withRoute'

const createSchema = z.object({
  fullName:             z.string().trim().min(1).max(200),
  email:                z.string().email().optional(),
  phone:                z.string().max(30).optional(),
  jobTitle:             z.string().max(200).optional(),
  // staff.department and staff.leave_balance are real columns (verified against
  // live schema) but were missing from this schema, so AddStaffModal's
  // Department and Leave Balance fields were silently dropped on submit.
  department:           z.string().max(200).optional(),
  leaveBalance:         z.number().int().nonnegative().max(365).optional(),
  role:                 z.enum(['admin','manager','staff','field_agent']).default('staff'),
  employmentType:       z.enum(['full_time','part_time','contract','casual','intern']).default('full_time'),
  startDate:            z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  salary:               z.number().positive().max(100_000_000).optional(),
  idNumber:             z.string().max(30).optional(),
  emergencyContactName:  z.string().max(200).optional(),
  emergencyContactPhone: z.string().max(30).optional(),
})

// Directory columns. salary / id_number / bank details are deliberately not
// here — the staff detail page reads them server-side for HR only.
const LIST_COLUMNS =
  'id, full_name, email, phone, role, department, job_title, employment_type, start_date, active, leave_balance, leave_taken, user_id, created_at'

// GET /api/staff — HR only. It used to return select('*') — salary, ID number
// and bank account for the whole team — to any logged-in member, with no
// permission check at all.
export const GET = withRoute({ action: 'staff.read' }, async ({ ctx }) => {
  return unwrap(await supabaseAdmin
    .from('staff')
    .select(LIST_COLUMNS)
    .eq('tenant_id', ctx.tenantId)
    .is('deleted_at', null)
    .order('full_name', { ascending: true })
    .limit(1000)) ?? []
})

// POST /api/staff — add a staff member. (staff.user_id is linked later by the
// invite flow, which must also write user_roles — see BUILD_JOURNEY A7.)
export const POST = withRoute({
  action: 'staff.write',
  body: createSchema,
  status: 201,
  audit: 'staff.created',
  resourceType: 'staff',
}, async ({ ctx, body }) => {
  const data = unwrap(await supabaseAdmin
    .from('staff')
    .insert({
      tenant_id:               ctx.tenantId,
      full_name:               body.fullName,
      email:                   body.email                 ?? null,
      phone:                   body.phone                 ?? null,
      job_title:               body.jobTitle              ?? null,
      department:              body.department            ?? null,
      leave_balance:           body.leaveBalance          ?? undefined,
      role:                    body.role,
      employment_type:         body.employmentType,
      start_date:              body.startDate             ?? null,
      salary:                  body.salary                ?? null,
      id_number:               body.idNumber              ?? null,
      emergency_contact_name:  body.emergencyContactName  ?? null,
      emergency_contact_phone: body.emergencyContactPhone ?? null,
    })
    .select(LIST_COLUMNS)
    .single(), { required: true })

  // First staff member added — auto-promote tenant to team mode
  await autoPromoteToTeamMode(ctx.tenantId)

  return data
})
