import { supabaseAdmin } from '@/lib/supabase/admin'
import { can } from '@/lib/auth/roleMatrix'
import { withRoute, unwrap, notFound } from '@/lib/api/withRoute'
import { ownStaffId, isTenantStaff } from '@/lib/people/ownStaff'

// GET /api/staff/[id]/payslips — payroll sees anyone's; an employee sees their
// own (staff.user_id link — the old comment said no such column existed; it
// does, so employees no longer need view_payroll to see their own pay).
export const GET = withRoute({ action: 'payslip.read_own' }, async ({ ctx, params }) => {
  const payroll = can(ctx, 'payroll.read')
  if (!payroll) {
    // Same 404 for "not yours" and "doesn't exist".
    if ((await ownStaffId(ctx.tenantId, ctx.userId)) !== params.id) throw notFound('Staff not found')
  } else if (!(await isTenantStaff(ctx.tenantId, params.id))) {
    throw notFound('Staff not found')
  }

  // Alias to real columns (gross_salary/net_pay/other_deductions_total). The
  // run join gives the pay period, which the list never had (so the app could
  // only label payslips by created_at).
  let q = supabaseAdmin
    .from('payslips')
    .select('id, tenant_id, payroll_run_id, staff_id, gross:gross_salary, paye, uif:uif_employee, deductions:other_deductions_total, net:net_pay, pdf_url, created_at, payroll_run:payroll_runs!inner(period_month, period_year, status)')
    .eq('tenant_id', ctx.tenantId)
    .eq('staff_id', params.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(120)

  // An employee sees a payslip once the run is paid — not while payroll is
  // still reviewing (draft/processing/finalised) and figures may change.
  // Filtered through the join: it used to load every paid run id in the
  // tenant first, a list that only grows.
  if (!payroll) q = q.eq('payroll_run.status', 'paid')

  return unwrap(await q) ?? []
})
