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

  // Alias to real columns (gross_salary/net_pay/other_deductions_total).
  let q = supabaseAdmin
    .from('payslips')
    .select('id, tenant_id, payroll_run_id, staff_id, gross:gross_salary, deductions:other_deductions_total, net:net_pay, pdf_url, created_at')
    .eq('tenant_id', ctx.tenantId)
    .eq('staff_id', params.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  // An employee sees a payslip once the run is paid — not while payroll is
  // still reviewing (draft/processing/finalised) and figures may change.
  if (!payroll) {
    const runs = unwrap(await supabaseAdmin
      .from('payroll_runs')
      .select('id')
      .eq('tenant_id', ctx.tenantId)
      .eq('status', 'paid')) ?? []
    if (runs.length === 0) return []
    q = q.in('payroll_run_id', runs.map((r) => r.id))
  }

  return unwrap(await q) ?? []
})
