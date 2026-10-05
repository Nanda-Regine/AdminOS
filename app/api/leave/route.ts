import { after } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { withRoute, unwrap, conflict, badRequest, RouteError } from '@/lib/api/withRoute'
import { can } from '@/lib/auth/roleMatrix'
import { ownStaffId, isTenantStaff } from '@/lib/people/ownStaff'
import { workingDaysBetween, saToday, daysBetween } from '@/lib/people/workingDays'
import { LEAVE_TYPES, LEAVE_LABELS, needsMedicalCertificate } from '@/lib/people/leaveTypes'
import { notify } from '@/lib/notifications/notify'
import { pushToUsers, usersWithPermission } from '@/lib/notifications/push'

// /api/leave — employees request leave and see their own; approvers see the team.
//
// Before this route there was no way for an employee to request leave at all:
// the approve/decline routes existed, but nothing created a request except
// the mobile app writing straight to the table with columns that don't exist
// (`type`) and calendar-day counts.

const DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')

const COLUMNS = 'id, staff_id, leave_type, start_date, end_date, days, reason, status, approved_at, created_at'

const listQuery = z.object({
  scope:  z.enum(['mine', 'team']).default('mine'),
  status: z.enum(['pending', 'approved', 'declined']).optional(),
  limit:  z.coerce.number().int().min(1).max(200).default(50),
})

// GET /api/leave?scope=mine  → { requests, balance }   (any member, own rows)
// GET /api/leave?scope=team  → { requests }            (approvers / HR)
export const GET = withRoute({ action: 'leave.request', query: listQuery }, async ({ ctx, query }) => {
  if (query.scope === 'team') {
    if (!can(ctx, 'leave.approve') && !can(ctx, 'staff.read')) {
      throw new RouteError(403, 'You do not have permission to see the team’s leave.', 'forbidden')
    }
    let q = supabaseAdmin
      .from('leave_requests')
      .select(`${COLUMNS}, staff(full_name, job_title)`)
      .eq('tenant_id', ctx.tenantId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(query.limit)
    if (query.status) q = q.eq('status', query.status)
    return { requests: unwrap(await q) ?? [] }
  }

  const staffId = await ownStaffId(ctx.tenantId, ctx.userId)
  if (!staffId) return { requests: [], balance: null, linked: false }

  let q = supabaseAdmin
    .from('leave_requests')
    .select(COLUMNS)
    .eq('tenant_id', ctx.tenantId)
    .eq('staff_id', staffId)
    .is('deleted_at', null)
    .order('start_date', { ascending: false })
    .limit(query.limit)
  if (query.status) q = q.eq('status', query.status)

  const [requests, staff] = await Promise.all([
    q,
    supabaseAdmin
      .from('staff')
      .select('leave_balance, leave_taken')
      .eq('id', staffId)
      .eq('tenant_id', ctx.tenantId)
      .maybeSingle(),
  ])
  const s = unwrap(staff)
  const entitlement = Number(s?.leave_balance ?? 0)
  const taken = Number(s?.leave_taken ?? 0)
  return {
    linked: true,
    requests: unwrap(requests) ?? [],
    balance: { entitlement, taken, remaining: entitlement - taken },
  }
})

const createSchema = z.object({
  leaveType: z.enum(LEAVE_TYPES),
  startDate: DATE,
  endDate:   DATE,
  halfDay:   z.boolean().default(false),
  reason:    z.string().trim().max(1000).optional(),
  /** HR filing on someone's behalf (e.g. a phoned-in sick day). Others: omit. */
  staffId:   z.string().uuid().optional(),
})

// POST /api/leave — file a request. Always born pending; only approvers decide.
export const POST = withRoute({
  action: 'leave.request',
  body: createSchema,
  status: 201,
  audit: 'leave.requested',
  resourceType: 'leave_request',
  rateLimit: 'api',
}, async ({ ctx, body }) => {
  // Whose leave: your own, unless HR files for someone else.
  let staffId: string | null
  if (body.staffId && can(ctx, 'staff.write')) {
    if (!(await isTenantStaff(ctx.tenantId, body.staffId))) throw badRequest('Staff member not found')
    staffId = body.staffId
  } else {
    staffId = await ownStaffId(ctx.tenantId, ctx.userId)
    if (!staffId) {
      throw new RouteError(403, 'Your login isn’t linked to a staff record yet — ask your employer to send you an app invite.', 'not_linked')
    }
  }

  if (body.endDate < body.startDate) throw badRequest('The end date is before the start date.')
  const today = saToday()
  if (daysBetween(body.startDate, today) > 60) throw badRequest('Leave can be backdated by at most 60 days — ask HR to capture older leave.')
  if (daysBetween(today, body.startDate) > 365) throw badRequest('Leave can be requested at most a year ahead.')
  if (body.halfDay && body.startDate !== body.endDate) throw badRequest('A half day must start and end on the same date.')

  let days: number
  try {
    days = workingDaysBetween(body.startDate, body.endDate)
  } catch (e) {
    throw badRequest((e as Error).message)
  }
  if (days === 0) throw badRequest('Those dates fall on weekends or public holidays — no leave is needed.')
  if (body.halfDay) days = 0.5

  // No overlapping live requests: approving both would double-deduct.
  const overlap = unwrap(await supabaseAdmin
    .from('leave_requests')
    .select('id, start_date, end_date, status')
    .eq('tenant_id', ctx.tenantId)
    .eq('staff_id', staffId)
    .in('status', ['pending', 'approved'])
    .is('deleted_at', null)
    .lte('start_date', body.endDate)
    .gte('end_date', body.startDate)
    .limit(1))
  if (overlap && overlap.length) {
    const o = overlap[0]
    throw conflict(`This overlaps your ${o.status} leave from ${o.start_date} to ${o.end_date}.`)
  }

  const row = unwrap(await supabaseAdmin
    .from('leave_requests')
    .insert({
      tenant_id:  ctx.tenantId,
      staff_id:   staffId,
      leave_type: body.leaveType,
      start_date: body.startDate,
      end_date:   body.endDate,
      days,
      reason:     body.reason || null,
      status:     'pending',
    })
    .select(COLUMNS)
    .single(), { required: true })

  // Tell the approvers — after the response, so a slow push never delays it.
  const tenantId = ctx.tenantId
  const requesterId = ctx.userId
  after(async () => {
    const { data: staff } = await supabaseAdmin
      .from('staff').select('full_name').eq('id', staffId).eq('tenant_id', tenantId).maybeSingle()
    const who = staff?.full_name ?? 'A team member'
    const label = LEAVE_LABELS[body.leaveType]
    const span = body.startDate === body.endDate ? body.startDate : `${body.startDate} → ${body.endDate}`
    const text = `${who}: ${label}, ${span} (${days} day${days === 1 ? '' : 's'})`
    await notify({
      tenantId, userId: null, type: 'leave_request', title: 'Leave request to approve', body: text,
      actionUrl: '/dashboard/team', data: { leave_request_id: row.id },
    })
    const approvers = (await usersWithPermission(tenantId, 'approve_leave')).filter((id) => id !== requesterId)
    await pushToUsers(tenantId, approvers, { title: 'Leave request to approve', body: text, route: '/approvals' })
  })

  return {
    ...row,
    medicalCertificateRequired: needsMedicalCertificate(body.leaveType, days),
  }
})
