import { NextResponse, after } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { withRoute, unwrap, conflict, badRequest, RouteError } from '@/lib/api/withRoute'
import { ownStaffId } from '@/lib/people/ownStaff'
import { notifyStaffMember } from '@/lib/notifications/staff'

// POST /api/expenses/[id]/approve — approve or reject a pending claim.
//
// The dashboard posts a native <form> (application/x-www-form-urlencoded, via
// ConfirmSubmit), so this reads formData and redirects back to the page. JSON
// callers ({ "action": "approve" }) get JSON back.
//
// Fixed 2026-10-05: permission was approve_leave (now the matrix's
// expenses.approve = view_financials); the audit row had no tenant_id; and the
// status check and the update were separate, so two approvers clicking at once
// both "succeeded". The update is now conditional on status still 'pending'.
export const POST = withRoute({
  action: 'expenses.approve',
  resourceType: 'expense',
}, async ({ request, ctx, params, audit }) => {
  const isForm = (request.headers.get('content-type') ?? '').includes('form')
  let action: string | null = null
  if (isForm) {
    action = (await request.formData()).get('action') as string | null
  } else {
    action = ((await request.json().catch(() => ({}))) as { action?: string }).action ?? null
  }
  if (action !== 'approve' && action !== 'reject') throw badRequest('action must be approve or reject')

  const existing = unwrap(await supabaseAdmin
    .from('expenses')
    .select('id, status, staff_id')
    .eq('id', params.id)
    .eq('tenant_id', ctx.tenantId)
    .is('deleted_at', null)
    .maybeSingle(), { required: true, what: 'Expense claim not found' })
  if (existing.status !== 'pending') throw conflict('This claim has already been dealt with.')

  // Separation of duties: nobody approves their own claim. The owner is the
  // one exception — there is no one above them to ask.
  if (ctx.role !== 'owner' && existing.staff_id === await ownStaffId(ctx.tenantId, ctx.userId)) {
    throw new RouteError(403, 'You cannot approve your own expense claim — ask another approver.', 'self_approval')
  }

  const updated = unwrap(await supabaseAdmin
    .from('expenses')
    .update({
      status:      action === 'approve' ? 'approved' : 'rejected',
      approved_by: ctx.userId,
      approved_at: new Date().toISOString(),
    })
    .eq('id', params.id)
    .eq('tenant_id', ctx.tenantId)
    .eq('status', 'pending')
    .select('id, status')
    .maybeSingle())
  if (!updated) throw conflict('This claim was just dealt with by someone else.')

  await audit({ action: `expense.${action}d`, resourceType: 'expense', resourceId: params.id })

  const tenantId = ctx.tenantId
  const approved = action === 'approve'
  if (existing.staff_id) {
    after(() => notifyStaffMember(tenantId, existing.staff_id as string, {
      type: approved ? 'expense_approved' : 'expense_rejected',
      title: approved ? 'Expense claim approved ✅' : 'Expense claim not approved',
      body: approved ? 'Your expense claim was approved for payment.' : 'Your expense claim was not approved. Speak to your manager for details.',
      route: '/expenses',
      data: { expense_id: params.id },
    }))
  }

  if (isForm) return NextResponse.redirect(new URL('/dashboard/expenses', new URL(request.url).origin), 303)
  return updated
})
