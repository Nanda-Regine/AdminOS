import { supabaseAdmin } from '@/lib/supabase/admin'
import { inngest } from '@/inngest/client'
import { withRoute, unwrap, conflict } from '@/lib/api/withRoute'

// POST /api/payroll/[id]/distribute
// Marks a completed payroll run as 'distributed' and fires the Inngest
// 'adminos/payroll.run.approved' event that delivers every payslip
// (WhatsApp / email / push). payroll.distribute = view_payroll.
export const POST = withRoute({
  action: 'payroll.distribute',
  audit: 'payroll.distributed',
  resourceType: 'payroll_run',
}, async ({ ctx, params }) => {
  const { tenantId } = ctx
  const payrollRunId = params.id

  // Only status is used below; period_start/period_end/staff_count don't exist
  // on payroll_runs (the select errored → distribution always 404'd).
  const run = unwrap(await supabaseAdmin
    .from('payroll_runs')
    .select('id, status')
    .eq('id', payrollRunId)
    .eq('tenant_id', tenantId)
    .maybeSingle(), { required: true, what: 'Payroll run not found' })

  if (run.status !== 'completed') {
    throw conflict(`Payroll run must be 'completed' before distribution. Current status: '${run.status}'`)
  }

  // Claim the run first, conditionally on it still being 'completed'. This
  // used to send the event and *then* mark it — a double-click (or two
  // managers at once) sent every employee's payslip twice.
  const updated = unwrap(await supabaseAdmin
    .from('payroll_runs')
    .update({ status: 'distributed' })
    .eq('id', payrollRunId)
    .eq('tenant_id', tenantId)
    .eq('status', 'completed')
    .select()
    .maybeSingle())
  if (!updated) throw conflict('This payroll run is already being distributed.')

  try {
    await inngest.send({
      name: 'adminos/payroll.run.approved',
      data: { tenant_id: tenantId, payroll_run_id: payrollRunId },
    })
  } catch (e) {
    // Nothing went out — release the claim so it can be retried.
    await supabaseAdmin.from('payroll_runs').update({ status: 'completed' })
      .eq('id', payrollRunId).eq('tenant_id', tenantId)
    throw e
  }

  return updated
})
