import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { withRoute, unwrap, conflict, RouteError } from '@/lib/api/withRoute'
import { can } from '@/lib/auth/roleMatrix'
import { ownStaffId } from '@/lib/people/ownStaff'

// DELETE /api/leave/[id] — withdraw a request that hasn't been decided yet.
// Soft delete (Rule #3). Your own pending request, or any pending one for HR.
// An approved request is not withdrawn here: its days are already deducted,
// so cancelling it is an HR adjustment, not a self-service undo.
export const DELETE = withRoute({
  action: 'leave.request',
  audit: 'leave.withdrawn',
  resourceType: 'leave_request',
}, async ({ ctx, params }) => {
  if (!z.string().uuid().safeParse(params.id).success) throw new RouteError(404, 'Leave request not found', 'not_found')
  const req = unwrap(await supabaseAdmin
    .from('leave_requests')
    .select('id, staff_id, status')
    .eq('id', params.id)
    .eq('tenant_id', ctx.tenantId)
    .is('deleted_at', null)
    .maybeSingle(), { required: true, what: 'Leave request not found' })

  if (!can(ctx, 'staff.write') && req.staff_id !== await ownStaffId(ctx.tenantId, ctx.userId)) {
    // Same answer as a missing id: don't confirm other people's requests exist.
    throw new RouteError(404, 'Leave request not found', 'not_found')
  }
  if (req.status !== 'pending') throw conflict(`This request was already ${req.status} — ask HR to change it.`)

  const done = unwrap(await supabaseAdmin
    .from('leave_requests')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', params.id)
    .eq('tenant_id', ctx.tenantId)
    .eq('status', 'pending')
    .is('deleted_at', null)
    .select('id')
    .maybeSingle())
  if (!done) throw conflict('This request was just decided by an approver.')
  return { id: params.id, withdrawn: true }
})
