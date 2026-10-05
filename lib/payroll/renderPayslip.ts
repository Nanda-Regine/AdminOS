import { supabaseAdmin } from '@/lib/supabase/admin'
import { generatePayslipHTML } from '@/lib/payroll/payslipTemplate'

/** The payslip row + joins renderPayslip needs. Columns verified against prod 2026-10-05. */
export const PAYSLIP_SELECT = `
  id, tenant_id, staff_id, gross_salary, paye, uif_employee, pension_deduction, other_deductions_total,
  net_pay, components, view_token_expires_at,
  staff:staff(id, full_name, id_number, job_title, department, employee_number, bank_name, bank_account_number),
  payroll_run:payroll_runs(period_month, period_year, processed_at, status)
`
// The previous select asked for payroll_runs.period_start/period_end/pay_date
// and staff.position — none of which exist — so every payslip request errored
// and 404'd, including the link WhatsApp'd to each employee.

type Row = Record<string, unknown>

const mask = (v: unknown, keep = 4) => {
  const s = typeof v === 'string' ? v.trim() : ''
  return s ? `${'•'.repeat(Math.max(0, s.length - keep))}${s.slice(-keep)}` : null
}

/**
 * Render one payslip as printable HTML. `masked` hides all but the last four
 * digits of the ID and bank account numbers — used for the token link, which
 * travels over WhatsApp and may be forwarded.
 */
export async function renderPayslip(payslip: Row, opts: { masked: boolean }): Promise<string> {
  const { data: tenant } = await supabaseAdmin
    .from('tenants')
    .select('name, settings')
    .eq('id', payslip.tenant_id as string)
    .single()

  const settings = (tenant?.settings as Record<string, string> | null) ?? null
  const staff = (payslip.staff as Row | null) ?? {}
  const run = (payslip.payroll_run as Row | null) ?? {}

  const month = Number(run.period_month), year = Number(run.period_year)
  const hasPeriod = month >= 1 && month <= 12 && year > 2000
  const fmt = (d: Date) => d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })

  const components = (payslip.components as Array<{ label?: string; description?: string; amount: number; type?: string }> | null) ?? []
  // Components store deductions as negative amounts; the payslip lists them as
  // positive figures under "Deductions". Employer costs (UIF employer, SDL)
  // are not the employee's deductions and are left off.
  const line = (c: { label?: string; description?: string; amount: number }) => ({
    description: c.label ?? c.description ?? '',
    amount: Math.abs(Number(c.amount) || 0),
  })
  const earnings = components.filter(c => c.type === 'earning' || !c.type).map(line)
  const deductions = components.filter(c => c.type === 'deduction').map(line)
  const totalDeductions = deductions.reduce((s, d) => s + d.amount, 0)

  const idNumber = opts.masked ? mask(staff.id_number) : ((staff.id_number as string) ?? null)
  const account = opts.masked ? mask(staff.bank_account_number) : ((staff.bank_account_number as string) ?? null)

  return generatePayslipHTML({
    logoUrl:          settings?.logo_url ?? null,
    employeeName:     (staff.full_name as string) ?? 'Employee',
    employeeNumber:   (staff.employee_number as string) ?? String(payslip.staff_id ?? '').slice(0, 8),
    idNumber,
    position:         (staff.job_title as string) ?? null,
    department:       (staff.department as string) ?? null,
    periodStart:      hasPeriod ? fmt(new Date(year, month - 1, 1)) : '',
    periodEnd:        hasPeriod ? fmt(new Date(year, month, 0)) : '',
    payDate:          run.processed_at ? fmt(new Date(run.processed_at as string)) : '',
    companyName:      tenant?.name ?? 'Company',
    companyAddress:   settings?.address ?? null,
    companyVatNumber: settings?.vat_number ?? null,
    earnings,
    deductions,
    grossPay:         Number(payslip.gross_salary ?? 0),
    totalDeductions,
    netPay:           Number(payslip.net_pay ?? 0),
    ytdGross:         null,
    ytdTax:           null,
    bankName:         (staff.bank_name as string) ?? null,
    accountNumber:    account,
    uifNumber:        settings?.uif_number ?? null,
  })
}

export const HTML_HEADERS = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'private, no-store',
  'X-Robots-Tag': 'noindex, nofollow',
  'Referrer-Policy': 'no-referrer',
}
