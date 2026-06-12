import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'
import { requirePermission } from '@/lib/auth/permissions'
import { calculatePayroll, generateEMP201 } from '@/lib/payroll/calculate'
import { writeAuditLog, getClientIp } from '@/lib/security/audit'
import { awardAchievement } from '@/lib/academy/checkAchievements'
import { fireBusinessEvent } from '@/lib/academy/knowledgeGraph'
import { inngest } from '@/inngest/client'

const schema = z.object({
  periodMonth: z.number().int().min(1).max(12),
  periodYear:  z.number().int().min(2020).max(2099),
})

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.user_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  try { await requirePermission('view_payroll') } catch {
    return new NextResponse('Forbidden', { status: 403 })
  }

  let body: z.infer<typeof schema>
  try { body = schema.parse(await request.json()) } catch (e) {
    return NextResponse.json({ error: 'Invalid request', detail: e }, { status: 400 })
  }

  // Check if this period already has a finalised run
  const { data: existing } = await supabaseAdmin
    .from('payroll_runs')
    .select('id, status')
    .eq('tenant_id', tenantId)
    .eq('period_month', body.periodMonth)
    .eq('period_year', body.periodYear)
    .maybeSingle()

  if (existing?.status === 'finalised') {
    return NextResponse.json({ error: 'Payroll already finalised for this period' }, { status: 409 })
  }

  // Fetch all active staff with salary
  const { data: staffList, error: staffErr } = await supabaseAdmin
    .from('staff')
    .select('id, full_name, salary, employment_type, job_title')
    .eq('tenant_id', tenantId)
    .eq('status', 'active')
    .not('salary', 'is', null)
    .gt('salary', 0)

  if (staffErr) return NextResponse.json({ error: staffErr.message }, { status: 400 })
  if (!staffList || staffList.length === 0) {
    return NextResponse.json({ error: 'No active staff with salary on record' }, { status: 400 })
  }

  // Calculate total annual payroll for SDL threshold
  const annualPayroll = staffList.reduce((s, st) => s + (st.salary ?? 0) * 12, 0)

  // Process each employee
  const payslipsToInsert = staffList.map((st) => {
    const result = calculatePayroll({
      grossMonthly:   st.salary!,
      annualPayroll,
    })
    return {
      staff:   st,
      payroll: result,
    }
  })

  // Aggregates
  const totals = payslipsToInsert.reduce(
    (acc, { payroll: p }) => ({
      gross:       acc.gross       + p.grossSalary,
      deductions:  acc.deductions  + p.paye + p.uifEmployee + p.pensionDeduction + p.otherDeductions,
      net:         acc.net         + p.netPay,
      paye:        acc.paye        + p.paye,
      uifEmployee: acc.uifEmployee + p.uifEmployee,
      uifEmployer: acc.uifEmployer + p.uifEmployer,
      sdl:         acc.sdl         + p.sdl,
    }),
    { gross: 0, deductions: 0, net: 0, paye: 0, uifEmployee: 0, uifEmployer: 0, sdl: 0 }
  )

  // Create or update payroll run
  const runPayload = {
    tenant_id:          tenantId,
    period_month:       body.periodMonth,
    period_year:        body.periodYear,
    status:             'processing',
    total_gross:        totals.gross,
    total_deductions:   totals.deductions,
    total_net:          totals.net,
    total_paye:         totals.paye,
    total_uif_employee: totals.uifEmployee,
    total_uif_employer: totals.uifEmployer,
    total_sdl:          totals.sdl,
    processed_at:       new Date().toISOString(),
  }

  const { data: run, error: runErr } = existing
    ? await supabaseAdmin.from('payroll_runs').update(runPayload).eq('id', existing.id).select().single()
    : await supabaseAdmin.from('payroll_runs').insert(runPayload).select().single()

  if (runErr || !run) return NextResponse.json({ error: runErr?.message ?? 'Run creation failed' }, { status: 400 })

  // Insert payslips
  const payslipRows = payslipsToInsert.map(({ staff: st, payroll: p }) => ({
    tenant_id:       tenantId,
    payroll_run_id:  run.id,
    staff_id:        st.id,
    gross_salary:    p.grossSalary,
    paye:            p.paye,
    uif_employee:    p.uifEmployee,
    uif_employer:    p.uifEmployer,
    sdl:             p.sdl,
    net_pay:         p.netPay,
    components:      p.components,
    other_deductions: [],
  }))

  await supabaseAdmin.from('payslips').insert(payslipRows)

  // Finalise the run
  await supabaseAdmin
    .from('payroll_runs')
    .update({ status: 'finalised' })
    .eq('id', run.id)

  // EMP201 data
  const emp201 = generateEMP201(
    payslipsToInsert.map(({ payroll: p }) => ({
      paye:        p.paye,
      uifEmployee: p.uifEmployee,
      uifEmployer: p.uifEmployer,
      sdl:         p.sdl,
    })),
    body.periodMonth,
    body.periodYear
  )

  await writeAuditLog({
    actor:        user.id,
    action:       'payroll.run',
    resourceType: 'payroll_run',
    resourceId:   run.id,
    ipAddress:    getClientIp(request),
    metadata:     { tenantId, periodMonth: body.periodMonth, periodYear: body.periodYear, staffCount: staffList.length },
  })

  // First payroll run — award achievement and trigger learning
  const { count } = await supabaseAdmin
    .from('payroll_runs')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('status', 'finalised')

  if ((count ?? 0) === 1) {
    await awardAchievement('employer', tenantId, user.id)
    fireBusinessEvent('payroll.first_run', tenantId, user.id)
  }

  // Trigger payslip WhatsApp distribution
  await inngest.send({
    name: 'adminos/payroll.run.approved',
    data: { tenant_id: tenantId, payroll_run_id: run.id },
  })

  return NextResponse.json({
    run:     { ...run, status: 'finalised' },
    emp201,
    payslip_count: staffList.length,
  }, { status: 201 })
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.user_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('payroll_runs')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('period_year', { ascending: false })
    .order('period_month', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
