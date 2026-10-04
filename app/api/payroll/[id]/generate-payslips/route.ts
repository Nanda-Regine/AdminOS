import { supabaseAdmin } from '@/lib/supabase/admin'
import { withRoute, unwrap, badRequest, conflict } from '@/lib/api/withRoute'

// POST /api/payroll/[id]/generate-payslips
// Triggers payslip generation for a payroll run. The run must be in 'draft' or 'processing'
// status. A payslip record (status='generating') is inserted for every active staff member
// in the tenant. The payroll run is set to 'processing'. payroll.run = view_payroll.
export const POST = withRoute({
  action: 'payroll.run',
  audit: 'payroll.payslips_generated',
  resourceType: 'payroll_run',
}, async ({ ctx, params }) => {
  const { tenantId } = ctx
  const payrollRunId = params.id

  const run = unwrap(await supabaseAdmin
    .from('payroll_runs')
    .select('id, status')
    .eq('id', payrollRunId)
    .eq('tenant_id', tenantId)
    .maybeSingle(), { required: true, what: 'Payroll run not found' })

  if (run.status !== 'draft' && run.status !== 'processing') {
    throw conflict(`Cannot generate payslips for a run with status '${run.status}'`)
  }

  const staffList = unwrap(await supabaseAdmin
    .from('staff')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('active', true)
    .is('deleted_at', null)) ?? []

  if (staffList.length === 0) throw badRequest('No active staff found for this business.')

  unwrap(await supabaseAdmin
    .from('payslips')
    .insert(staffList.map((st) => ({
      tenant_id:      tenantId,
      payroll_run_id: payrollRunId,
      staff_id:       st.id,
      status:         'generating',
    }))))

  unwrap(await supabaseAdmin
    .from('payroll_runs')
    .update({ status: 'processing' })
    .eq('id', payrollRunId)
    .eq('tenant_id', tenantId))

  return { id: payrollRunId, payroll_run_id: payrollRunId, payslips_queued: staffList.length }
})
