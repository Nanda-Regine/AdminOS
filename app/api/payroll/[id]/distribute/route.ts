import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { inngest } from '@/inngest/client'

// POST /api/payroll/[id]/distribute
// Marks a completed payroll run as 'distributed', fires the Inngest
// 'adminos/payroll.distribute' event to handle payslip delivery, and returns
// the updated run id.
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

  if (run.status !== 'completed') {
    return NextResponse.json(
      { error: `Payroll run must be 'completed' before distribution. Current status: '${run.status}'` },
      { status: 400 },
    )
  }

  // Fire Inngest event to handle actual payslip distribution (WhatsApp / email / push)
  await inngest.send({
    name: 'adminos/payroll.run.approved',
    data: {
      tenant_id:      tenantId,
      payroll_run_id: payrollRunId,
    },
  })

  // Mark the run as distributed
  const { data: updated, error: updateErr } = await supabaseAdmin
    .from('payroll_runs')
    .update({ status: 'distributed' })
    .eq('id', payrollRunId)
    .select()
    .single()

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 400 })

  return NextResponse.json(updated)
}
