import { randomBytes } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'
import { calculatePayroll, generateEMP201, taxTableFor } from '@/lib/payroll/calculate'
import { awardAchievement } from '@/lib/academy/checkAchievements'
import { fireBusinessEvent } from '@/lib/academy/knowledgeGraph'
import { withRoute, unwrap, conflict, badRequest } from '@/lib/api/withRoute'

/**
 * Payroll run lifecycle — matches the live payroll_runs_status_check
 * (draft | processing | finalised | paid):
 *
 *   POST /api/payroll/run            → processing → finalised   (calculate; re-runnable)
 *   POST /api/payroll/[id]/distribute → finalised → paid         (send payslips; final)
 *
 * Before 2026-10-05 the routes disagreed with the database and each other:
 * this route finalised AND immediately fired the distribution event (so
 * payslips went out with no review, despite the form saying "you review
 * before distributing"), distribute required a 'completed' status the
 * constraint doesn't allow, and generate-payslips inserted rows with columns
 * that don't exist. No run had ever succeeded in production.
 */

const schema = z.object({
  periodMonth: z.number().int().min(1).max(12),
  periodYear:  z.number().int().min(2020).max(2099),
})

/** A run stuck in 'processing' this long (crashed mid-way) may be reclaimed. */
const STALE_MS = 10 * 60 * 1000
/** Payslip view links stay valid this long after the run is calculated. */
const LINK_TTL_MS = 60 * 24 * 60 * 60 * 1000

type Run = { id: string; status: string; processed_at: string | null }

export const POST = withRoute({
  action: 'payroll.run',
  body: schema,
  status: 201,
  audit: 'payroll.run',
  resourceType: 'payroll_run',
}, async ({ ctx, body }) => {
  const { tenantId, userId } = ctx
  const { periodMonth, periodYear } = body
  const now = new Date()

  // ── 1. Claim the period. Two clicks (or two managers) must not both
  //       calculate and insert payslips.
  const existing = unwrap(await supabaseAdmin
    .from('payroll_runs')
    .select('id, status, processed_at')
    .eq('tenant_id', tenantId)
    .eq('period_month', periodMonth)
    .eq('period_year', periodYear)
    .is('deleted_at', null)
    .maybeSingle()) as Run | null

  if (existing?.status === 'paid') {
    throw conflict('Payroll for this period has already been paid and its payslips sent. It can no longer be recalculated.')
  }

  let run: Run
  if (existing) {
    const stale = !existing.processed_at || now.getTime() - new Date(existing.processed_at).getTime() > STALE_MS
    if (existing.status === 'processing' && !stale) throw conflict('Payroll for this period is already being calculated.')
    const claimed = unwrap(await supabaseAdmin
      .from('payroll_runs')
      .update({ status: 'processing', processed_at: now.toISOString() })
      .eq('id', existing.id)
      .eq('tenant_id', tenantId)
      .eq('status', existing.status)
      .select('id, status, processed_at')
      .maybeSingle()) as Run | null
    if (!claimed) throw conflict('Payroll for this period was just changed by someone else — try again.')
    run = claimed
  } else {
    const res = await supabaseAdmin
      .from('payroll_runs')
      .insert({ tenant_id: tenantId, period_month: periodMonth, period_year: periodYear, status: 'processing', processed_at: now.toISOString() })
      .select('id, status, processed_at')
      .single()
    if (res.error?.code === '23505') throw conflict('Payroll for this period is already being calculated.')
    run = unwrap(res) as Run
  }

  try {
    // ── 2. Who is paid.
    const staffList = unwrap(await supabaseAdmin
      .from('staff')
      .select('id, full_name, salary')
      .eq('tenant_id', tenantId)
      .eq('active', true)
      .is('deleted_at', null)
      .gt('salary', 0)) ?? []
    if (staffList.length === 0) throw badRequest('No active staff with a salary on record. Add salaries on the Staff page first.')

    // ── 3. Calculate with the tax tables for THIS period (not today's).
    const annualPayroll = staffList.reduce((s, st) => s + Number(st.salary ?? 0) * 12, 0)
    const calculated = staffList.map((st) => ({
      staff: st,
      payroll: calculatePayroll({ grossMonthly: Number(st.salary), annualPayroll, periodMonth, periodYear }),
    }))

    const r2 = (n: number) => Math.round(n * 100) / 100
    const totals = calculated.reduce(
      (acc, { payroll: p }) => ({
        gross:       acc.gross       + p.grossSalary,
        deductions:  acc.deductions  + p.paye + p.uifEmployee + p.pensionDeduction + p.otherDeductions,
        net:         acc.net         + p.netPay,
        paye:        acc.paye        + p.paye,
        uifEmployee: acc.uifEmployee + p.uifEmployee,
        uifEmployer: acc.uifEmployer + p.uifEmployer,
        sdl:         acc.sdl         + p.sdl,
      }),
      { gross: 0, deductions: 0, net: 0, paye: 0, uifEmployee: 0, uifEmployer: 0, sdl: 0 },
    )
    const emp201 = generateEMP201(calculated.map(({ payroll: p }) => p), periodMonth, periodYear)

    // ── 4. Replace any payslips from an earlier calculation of this run.
    //       Soft delete (Rule #3); the partial unique index allows one live
    //       payslip per employee per run.
    unwrap(await supabaseAdmin
      .from('payslips')
      .update({ deleted_at: now.toISOString(), view_token_expires_at: now.toISOString() })
      .eq('tenant_id', tenantId)
      .eq('payroll_run_id', run.id)
      .is('deleted_at', null))

    const expires = new Date(now.getTime() + LINK_TTL_MS).toISOString()
    unwrap(await supabaseAdmin.from('payslips').insert(calculated.map(({ staff: st, payroll: p }) => ({
      tenant_id:             tenantId,
      payroll_run_id:        run.id,
      staff_id:              st.id,
      gross_salary:          p.grossSalary,
      paye:                  p.paye,
      uif_employee:          p.uifEmployee,
      uif_employer:          p.uifEmployer,
      sdl:                   p.sdl,
      pension_deduction:     p.pensionDeduction,
      other_deductions_total: p.otherDeductions,
      net_pay:               p.netPay,
      components:            p.components,
      other_deductions:      [],
      view_token:            randomBytes(32).toString('hex'),
      view_token_expires_at: expires,
    }))))

    // ── 5. Finalise — ready for the owner to review, then distribute.
    const finalised = unwrap(await supabaseAdmin
      .from('payroll_runs')
      .update({
        status:             'finalised',
        total_gross:        r2(totals.gross),
        total_deductions:   r2(totals.deductions),
        total_net:          r2(totals.net),
        total_paye:         r2(totals.paye),
        total_uif_employee: r2(totals.uifEmployee),
        total_uif_employer: r2(totals.uifEmployer),
        total_sdl:          r2(totals.sdl),
        // Cached for the EMP201 export. It was never written before, so every
        // export regenerated from rows through a camelCase reader → UIF = NaN.
        emp201_data:        emp201,
        processed_at:       new Date().toISOString(),
      })
      .eq('id', run.id)
      .eq('tenant_id', tenantId)
      .select()
      .single())

    // First-ever payroll for this business — achievement + learning trigger.
    if (!existing) {
      const { count } = await supabaseAdmin
        .from('payroll_runs')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .in('status', ['finalised', 'paid'])
        .is('deleted_at', null)
      if ((count ?? 0) === 1) {
        await awardAchievement('employer', tenantId, userId)
        fireBusinessEvent('payroll.first_run', tenantId, userId)
      }
    }

    return {
      id: run.id,
      run: finalised,
      emp201,
      payslip_count: staffList.length,
      tax_year: taxTableFor(periodMonth, periodYear).year,
    }
  } catch (e) {
    // Release the claim so the owner can fix the cause and run again. Always to
    // 'draft': earlier payslips may already have been replaced, and only a
    // 'finalised' run can be distributed.
    await supabaseAdmin.from('payroll_runs').update({ status: 'draft' })
      .eq('id', run.id).eq('tenant_id', tenantId).eq('status', 'processing')
    throw e
  }
})

export const GET = withRoute({ action: 'payroll.read' }, async ({ ctx }) =>
  unwrap(await supabaseAdmin
    .from('payroll_runs')
    .select('id, period_month, period_year, status, total_gross, total_deductions, total_net, total_paye, total_uif_employee, total_uif_employer, total_sdl, processed_at, created_at')
    .eq('tenant_id', ctx.tenantId)
    .is('deleted_at', null)
    .order('period_year', { ascending: false })
    .order('period_month', { ascending: false })
    .limit(36)) ?? [],
)
