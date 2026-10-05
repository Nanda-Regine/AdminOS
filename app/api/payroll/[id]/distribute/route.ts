import { supabaseAdmin } from '@/lib/supabase/admin'
import { inngest } from '@/inngest/client'
import { withRoute, unwrap, conflict } from '@/lib/api/withRoute'

// POST /api/payroll/[id]/distribute
// The owner has reviewed a finalised run: mark it paid and send every
// employee their payslip (adminos/payroll.run.approved → payslipDistribution).
// payroll.distribute = view_payroll.
//
// Statuses follow the live payroll_runs_status_check (draft | processing |
// finalised | paid). This route used to require 'completed' and write
// 'distributed' — neither is allowed by the constraint, so it could never work.
export const POST = withRoute({
  action: 'payroll.distribute',
  audit: 'payroll.distributed',
  resourceType: 'payroll_run',
}, async ({ ctx, params }) => {
  const { tenantId } = ctx
  const payrollRunId = params.id

  const run = unwrap(await supabaseAdmin
    .from('payroll_runs')
    .select('id, status')
    .eq('id', payrollRunId)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .maybeSingle(), { required: true, what: 'Payroll run not found' })

  if (run.status === 'paid') throw conflict('These payslips have already been sent.')
  if (run.status !== 'finalised') throw conflict('Calculate payroll for this period first, then send payslips.')

  const { count } = await supabaseAdmin
    .from('payslips')
    .select('id', { count: 'exact', head: true })
    .eq('payroll_run_id', payrollRunId)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
  if (!count) throw conflict('This run has no payslips. Recalculate payroll for the period.')

  // Claim first, conditionally on it still being 'finalised', so a
  // double-click (or two managers at once) can't send every payslip twice.
  const updated = unwrap(await supabaseAdmin
    .from('payroll_runs')
    .update({ status: 'paid' })
    .eq('id', payrollRunId)
    .eq('tenant_id', tenantId)
    .eq('status', 'finalised')
    .select()
    .maybeSingle())
  if (!updated) throw conflict('These payslips are already being sent.')

  try {
    await inngest.send({
      name: 'adminos/payroll.run.approved',
      data: { tenant_id: tenantId, payroll_run_id: payrollRunId },
    })
  } catch (e) {
    // Nothing went out — release the claim so it can be retried.
    await supabaseAdmin.from('payroll_runs').update({ status: 'finalised' })
      .eq('id', payrollRunId).eq('tenant_id', tenantId)
    throw e
  }

  return { ...updated, payslip_count: count }
})
