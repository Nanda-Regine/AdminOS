import { NextResponse, after } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { RouteError, conflict, unwrap } from '@/lib/api/withRoute'
import { ownStaffId } from '@/lib/people/ownStaff'
import { drawsAnnualBalance } from '@/lib/people/leaveTypes'
import { notifyStaffMember } from '@/lib/notifications/staff'
import type { Context } from '@/lib/auth/context'

type Decision = 'approved' | 'declined'

/**
 * Approve or decline a pending leave request.
 *
 * Fixed 2026-10-05 (People sweep):
 *  - permission was manage_staff, so a `manager` (who holds approve_leave and
 *    is sent here by the People cockpit) could never approve anything;
 *  - status check and update were separate, so a double-click or two approvers
 *    both "approved" and leave_taken was deducted twice;
 *  - an approved request could be re-declined (balance never restored) and a
 *    declined one re-approved;
 *  - nothing stopped an approver approving their own leave;
 *  - the balance update was a read-modify-write with no tenant filter, racing
 *    any other approval for the same person.
 */
export async function decideLeave(ctx: Context, id: string, decision: Decision) {
  const req = unwrap(await supabaseAdmin
    .from('leave_requests')
    // '*' rather than a column list: leave_type arrives with migration
    // 20261005_mobile_app_foundations, and approvals must keep working on a
    // database that doesn't have it yet (it then defaults to annual).
    .select('*')
    .eq('id', id)
    .eq('tenant_id', ctx.tenantId)
    .is('deleted_at', null)
    .maybeSingle(), { required: true, what: 'Leave request not found' })

  if (req.status !== 'pending') throw conflict(`This request was already ${req.status}.`)

  if (ctx.role !== 'owner' && req.staff_id === await ownStaffId(ctx.tenantId, ctx.userId)) {
    throw new RouteError(403, 'You cannot decide your own leave request — ask another approver.', 'self_approval')
  }

  const updated = unwrap(await supabaseAdmin
    .from('leave_requests')
    .update({ status: decision, approved_by: ctx.userId, approved_at: new Date().toISOString() })
    .eq('id', id)
    .eq('tenant_id', ctx.tenantId)
    .eq('status', 'pending')
    .select('id, status')
    .maybeSingle())
  if (!updated) throw conflict('This request was just dealt with by someone else.')

  let remaining: number | null = null
  // Only annual leave draws down the annual balance — approving sick or
  // family-responsibility leave used to deduct annual days too.
  if (decision === 'approved' && Number(req.days) > 0 && drawsAnnualBalance(req.leave_type as string | undefined)) {
    remaining = await addLeaveTaken(ctx.tenantId, req.staff_id, Number(req.days))
  }

  // The employee used to find out only by asking. after() keeps the push off
  // the approver's response time.
  const tenantId = ctx.tenantId
  const span = req.start_date === req.end_date ? req.start_date : `${req.start_date} → ${req.end_date}`
  after(() => notifyStaffMember(tenantId, req.staff_id as string, {
    type: `leave_${decision}`,
    title: decision === 'approved' ? 'Leave approved ✅' : 'Leave declined',
    body: decision === 'approved'
      ? `Your leave for ${span} was approved.${remaining != null ? ` ${remaining} annual day${remaining === 1 ? '' : 's'} left.` : ''}`
      : `Your leave for ${span} was declined. Speak to your manager for details.`,
    route: '/leave',
    data: { leave_request_id: id },
  }))

  return { id, status: decision, remaining }
}

/**
 * leave_taken += days, compare-and-swap so concurrent approvals for the same
 * person can't overwrite each other. Returns days remaining (may go negative:
 * leave beyond the balance is unpaid leave under the BCEA, not an error).
 */
async function addLeaveTaken(tenantId: string, staffId: string, days: number): Promise<number | null> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const staff = unwrap(await supabaseAdmin
      .from('staff')
      .select('leave_balance, leave_taken')
      .eq('id', staffId)
      .eq('tenant_id', tenantId)
      .maybeSingle())
    if (!staff) return null
    const before = Number(staff.leave_taken ?? 0)
    const after = before + days
    const swapped = unwrap(await supabaseAdmin
      .from('staff')
      .update({ leave_taken: after })
      .eq('id', staffId)
      .eq('tenant_id', tenantId)
      .eq('leave_taken', before)
      .select('id')
      .maybeSingle())
    if (swapped) return Number(staff.leave_balance ?? 0) - after
  }
  throw new RouteError(409, 'Leave balance is being updated by someone else — please try again.', 'conflict')
}

/**
 * The staff and team pages approve via native <form> posts. Send the browser
 * back to the page it came from (same origin, dashboard only), with a notice
 * instead of a raw JSON error page.
 */
export function backToPage(request: Request, notice?: string): Response {
  const origin = new URL(request.url).origin
  let path = '/dashboard/team'
  const ref = request.headers.get('referer')
  if (ref) {
    try {
      const u = new URL(ref)
      if (u.origin === origin && u.pathname.startsWith('/dashboard/')) path = u.pathname
    } catch { /* keep default */ }
  }
  const url = new URL(path, origin)
  if (notice) url.searchParams.set('notice', notice)
  return NextResponse.redirect(url, 303)
}

export function isFormPost(request: Request): boolean {
  return (request.headers.get('content-type') ?? '').includes('form')
}
