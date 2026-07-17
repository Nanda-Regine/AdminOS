import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

// POST /api/payroll/[id]/generate-payslips
// Triggers payslip generation for a payroll run. The run must be in 'draft' or 'processing'
// status. A payslip record (status='generating') is inserted for every active staff member
// in the tenant. The payroll run is set to 'processing'.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.app_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  const { id: payrollRunId } = await params

  // Fetch the payroll run and verify tenant ownership
  const { data: run, error: runErr } = await supabaseAdmin
    .from('payroll_runs')
    .select('id, tenant_id, status, period_start, period_end, staff_count')
    .eq('id', payrollRunId)
    .eq('tenant_id', tenantId)
    .single()

  if (runErr || !run) return new NextResponse('Payroll run not found', { status: 404 })

  if (run.status !== 'draft' && run.status !== 'processing') {
    return NextResponse.json(
      { error: `Cannot generate payslips for a run with status '${run.status}'` },
      { status: 400 },
    )
  }

  // Fetch all active staff for this tenant
  const { data: staffList, error: staffErr } = await supabaseAdmin
    .from('staff')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('status', 'active')

  if (staffErr) return NextResponse.json({ error: staffErr.message }, { status: 400 })
  if (!staffList || staffList.length === 0) {
    return NextResponse.json({ error: 'No active staff found for this tenant' }, { status: 400 })
  }

  // Build payslip rows — one per active staff member
  const payslipRows = staffList.map((st) => ({
    tenant_id:      tenantId,
    payroll_run_id: payrollRunId,
    staff_id:       st.id,
    status:         'generating',
  }))

  const { error: insertErr } = await supabaseAdmin
    .from('payslips')
    .insert(payslipRows)

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 400 })

  // Move the run to 'processing'
  await supabaseAdmin
    .from('payroll_runs')
    .update({ status: 'processing' })
    .eq('id', payrollRunId)

  return NextResponse.json({
    payroll_run_id:  payrollRunId,
    payslips_queued: staffList.length,
  })
}
