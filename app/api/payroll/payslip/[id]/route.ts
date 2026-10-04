import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { generatePayslipHTML } from '@/lib/payroll/payslipTemplate'
import { withRoute, notFound, RouteError } from '@/lib/api/withRoute'
import { can } from '@/lib/auth/roleMatrix'

// GET /api/payroll/payslip/[id]
// Returns a printable HTML payslip. Employees see only their own; anyone with
// payroll.read (owner/admin by default) sees all.
// Add ?download=true to get Content-Disposition: attachment (triggers browser download)
export const GET = withRoute({ action: 'payslip.read_own' }, async ({ request, ctx, params }) => {
  const { tenantId, userId } = ctx
  const { id } = params

  const { data: payslip, error } = await supabaseAdmin
    .from('payslips')
    .select(`
      *,
      staff:staff(id, full_name, id_number, position, department, phone, employee_number),
      payroll_run:payroll_runs(period_start, period_end, pay_date)
    `)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single()

  if (error || !payslip) throw notFound()

  // Employees can only view their own payslip.
  //
  // This used to compare against user_metadata.staff_id — a value the user owns
  // and can rewrite, and which nothing in the codebase ever wrote. Any staff
  // member could set it to a colleague's staff id and read that colleague's
  // salary. The caller's staff record is now resolved from the DB via
  // staff.user_id (unique per tenant), which they cannot forge.
  //
  // The manager test used to be a role-name list including 'hr_manager' — a
  // role that does not exist — read from app_metadata rather than the tenant's
  // roles table. It is now the role matrix's payroll.read.
  const isManager = can(ctx, 'payroll.read')
  const staffRecord = payslip.staff as Record<string, unknown> | null

  if (!isManager) {
    const { data: ownStaff } = await supabaseAdmin
      .from('staff')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .maybeSingle()

    if (!ownStaff || staffRecord?.id !== ownStaff.id) {
      throw new RouteError(403, 'You can only view your own payslip.', 'forbidden')
    }
  }

  const { data: tenant } = await supabaseAdmin
    .from('tenants')
    .select('name, settings')
    .eq('id', tenantId)
    .single()

  const settings    = tenant?.settings as Record<string, string> | null
  const payrollRun  = payslip.payroll_run as Record<string, string>

  const components = payslip.components as Array<{ description: string; amount: number; type: string }> ?? []
  const earnings   = components.filter(c => c.type === 'earning' || !c.type)
  const deductions = components.filter(c => c.type === 'deduction')

  const html = generatePayslipHTML({
    logoUrl:          (settings?.logo_url as string) ?? null,
    employeeName:     (staffRecord?.full_name    as string) ?? 'Employee',
    employeeNumber:   (staffRecord?.employee_number as string) ?? String(payslip.staff_id ?? '').slice(0, 8),
    idNumber:         (staffRecord?.id_number    as string) ?? null,
    position:         (staffRecord?.position     as string) ?? null,
    department:       (staffRecord?.department   as string) ?? null,
    periodStart:      payrollRun?.period_start ? new Date(payrollRun.period_start).toLocaleDateString('en-ZA') : '',
    periodEnd:        payrollRun?.period_end   ? new Date(payrollRun.period_end).toLocaleDateString('en-ZA')   : '',
    payDate:          payrollRun?.pay_date     ? new Date(payrollRun.pay_date).toLocaleDateString('en-ZA')     : '',
    companyName:      tenant?.name ?? 'Company',
    companyAddress:   settings?.address ?? null,
    companyVatNumber: settings?.vat_number ?? null,
    earnings:         earnings.map(e => ({ description: e.description, amount: e.amount })),
    deductions:       deductions.map(d => ({ description: d.description, amount: d.amount })),
    grossPay:         payslip.gross_salary      ?? 0,
    totalDeductions:  payslip.paye + payslip.uif_employee + (payslip.pension_deduction ?? 0) + (payslip.other_deductions_total ?? 0),
    netPay:           payslip.net_pay           ?? 0,
    ytdGross:         null,
    ytdTax:           null,
    // Bank details live on the staff record but aren't in this select; YTD needs a
    // period aggregation — both hide gracefully until wired. UIF ref is a tenant setting.
    bankName:         null,
    accountNumber:    null,
    uifNumber:        (settings?.uif_number as string) ?? null,
  })

  const url      = new URL(request.url)
  const download = url.searchParams.get('download') === 'true'

  const headers: Record<string, string> = {
    'Content-Type':  'text/html; charset=utf-8',
    'Cache-Control': 'private, no-store',
  }

  if (download) {
    const name     = (staffRecord?.full_name as string)?.replace(/\s+/g, '-') ?? 'employee'
    const payDate  = payrollRun?.pay_date?.split('T')[0] ?? 'unknown'
    headers['Content-Disposition'] = `attachment; filename="payslip-${name}-${payDate}.html"`
  }

  return new NextResponse(html, { headers })
})
