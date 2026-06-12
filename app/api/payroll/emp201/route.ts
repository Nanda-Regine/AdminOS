import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { generateEMP201 } from '@/lib/payroll/calculate'
import { checkPermission } from '@/lib/auth/permissions'

// GET /api/payroll/emp201?month=6&year=2026
// Returns EMP201 totals for a given pay period

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.user_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  if (!(await checkPermission('view_payroll'))) return new NextResponse('Forbidden', { status: 403 })

  const url   = new URL(request.url)
  const month = parseInt(url.searchParams.get('month') ?? String(new Date().getMonth() + 1))
  const year  = parseInt(url.searchParams.get('year')  ?? String(new Date().getFullYear()))

  if (isNaN(month) || month < 1 || month > 12 || isNaN(year)) {
    return NextResponse.json({ error: 'Invalid month or year' }, { status: 400 })
  }

  // Fetch the payroll run for this period
  const { data: run, error: runError } = await supabaseAdmin
    .from('payroll_runs')
    .select('id, period_month, period_year, status, emp201_data')
    .eq('tenant_id', tenantId)
    .eq('period_month', month)
    .eq('period_year', year)
    .maybeSingle()

  if (runError) return NextResponse.json({ error: runError.message }, { status: 400 })

  if (!run) {
    return NextResponse.json({
      message: `No payroll run found for ${month}/${year}. Run payroll first via POST /api/payroll/run.`,
    }, { status: 404 })
  }

  // If EMP201 data was already generated, return it
  if (run.emp201_data) {
    return NextResponse.json({ run_id: run.id, period: { month, year }, emp201: run.emp201_data })
  }

  // Regenerate from payslips
  const { data: payslips, error: psError } = await supabaseAdmin
    .from('payslips')
    .select('*')
    .eq('payroll_run_id', run.id)

  if (psError) return NextResponse.json({ error: psError.message }, { status: 400 })

  const emp201 = generateEMP201(payslips ?? [], month, year)

  // Cache EMP201 data on the run
  await supabaseAdmin
    .from('payroll_runs')
    .update({ emp201_data: emp201 })
    .eq('id', run.id)

  return NextResponse.json({ run_id: run.id, period: { month, year }, emp201 })
}
