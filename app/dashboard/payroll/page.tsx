import { createClient } from '@/lib/supabase/server'
import { RunPayrollForm } from './RunPayrollForm'
import { PayrollRunActions } from './PayrollRunActions'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { TopBar } from '@/components/dashboard/TopBar'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { redirect, notFound } from 'next/navigation'
import { Wallet } from 'lucide-react'
import { checkPermission } from '@/lib/auth/permissions'
import { formatZAR } from '@/lib/format'

// Matches the live payroll_runs_status_check: draft | processing | finalised | paid.
// ('completed'/'distributed' were shown here but can't exist in the database.)
const statusVariant: Record<string, 'gray' | 'yellow' | 'green' | 'blue'> = {
  draft: 'gray',
  processing: 'yellow',
  finalised: 'blue',
  paid: 'green',
}
const statusLabel: Record<string, string> = {
  draft: 'Needs calculating',
  processing: 'Calculating…',
  finalised: 'Ready to review',
  paid: 'Paid · payslips sent',
}

type Payslip = {
  id: string
  gross_salary: number
  paye: number
  uif_employee: number
  net_pay: number
  delivered_at: string | null
  staff: { full_name: string | null } | null
}

export default async function PayrollPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // view_payroll, not manage_staff: someone can run payroll without seeing
  // every individual's HR record, and vice versa.
  if (!(await checkPermission('view_payroll'))) notFound()

  const tenantId = user.app_metadata?.tenant_id as string

  const { data: runs } = await supabaseAdmin
    .from('payroll_runs')
    .select('id, period_month, period_year, status, total_gross, total_net, total_paye, total_uif_employee, total_uif_employer, total_sdl, created_at, processed_at')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('period_year', { ascending: false })
    .order('period_month', { ascending: false })
    .limit(12)

  const allRuns = runs || []
  const latestRun = allRuns[0] || null

  // Per-employee review of the latest run — the point of "review before sending".
  const { data: slipRows } = latestRun
    ? await supabaseAdmin
        .from('payslips')
        .select('id, gross_salary, paye, uif_employee, net_pay, delivered_at, staff:staff(full_name)')
        .eq('tenant_id', tenantId)
        .eq('payroll_run_id', latestRun.id)
        .is('deleted_at', null)
        .order('net_pay', { ascending: false })
        .limit(500)
    : { data: [] }
  const payslips = (slipRows ?? []) as unknown as Payslip[]

  const now = new Date()

  return (
    <div>
      <TopBar title="Payroll" subtitle="Calculate, review, then send payslips"
        actions={<RunPayrollForm defaultMonth={now.getMonth() + 1} defaultYear={now.getFullYear()} />} />
      <div className="p-4 md:p-6 space-y-6">

        {latestRun ? (
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm text-[var(--text-muted)] mb-1">Latest run</p>
                <h3 className="font-semibold text-[var(--text-primary)] text-lg">
                  {new Date(latestRun.period_year, latestRun.period_month - 1, 1).toLocaleDateString('en-ZA', { timeZone: 'Africa/Johannesburg', month: 'long', year: 'numeric' })}
                </h3>
                <div className="mt-2">
                  <Badge variant={statusVariant[latestRun.status] || 'gray'}>{statusLabel[latestRun.status] ?? latestRun.status}</Badge>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-[var(--text-dim)]">Gross / Net</p>
                <p className="text-xl font-bold text-[var(--text-primary)] mt-0.5">{formatZAR(Number(latestRun.total_gross || 0))}</p>
                <p className="text-sm text-emerald-600">{formatZAR(Number(latestRun.total_net || 0))} net</p>
                <p className="text-xs text-[var(--text-dim)] mt-1">
                  PAYE {formatZAR(Number(latestRun.total_paye || 0))} · UIF {formatZAR(Number(latestRun.total_uif_employee || 0) + Number(latestRun.total_uif_employer || 0))} · SDL {formatZAR(Number(latestRun.total_sdl || 0))}
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-start gap-3">
              <PayrollRunActions runId={latestRun.id} status={latestRun.status}
                periodMonth={latestRun.period_month} periodYear={latestRun.period_year} payslipCount={payslips.length} />
              {['finalised', 'paid'].includes(latestRun.status) && (
                <a href={`/api/payroll/emp201?format=csv&month=${latestRun.period_month}&year=${latestRun.period_year}`}
                  className="text-sm border border-[var(--border)] text-[var(--text-secondary)] px-4 py-2 rounded-lg hover:bg-[var(--surface-hover)] transition-colors">
                  Download EMP201
                </a>
              )}
            </div>

            {payslips.length > 0 && (
              <div className="mt-6 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-xs text-[var(--text-muted)] uppercase tracking-wide">
                      <th className="text-left py-2 pr-4">Employee</th>
                      <th className="text-right py-2 px-4">Gross</th>
                      <th className="text-right py-2 px-4">PAYE</th>
                      <th className="text-right py-2 px-4">UIF</th>
                      <th className="text-right py-2 px-4">Net</th>
                      <th className="text-left py-2 pl-4">Payslip</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {payslips.map((p) => (
                      <tr key={p.id}>
                        <td className="py-2 pr-4 text-[var(--text-primary)]">{p.staff?.full_name ?? 'Employee'}</td>
                        <td className="py-2 px-4 text-right tabular-nums">{formatZAR(Number(p.gross_salary))}</td>
                        <td className="py-2 px-4 text-right tabular-nums">{formatZAR(Number(p.paye))}</td>
                        <td className="py-2 px-4 text-right tabular-nums">{formatZAR(Number(p.uif_employee))}</td>
                        <td className="py-2 px-4 text-right tabular-nums font-semibold text-emerald-600">{formatZAR(Number(p.net_pay))}</td>
                        <td className="py-2 pl-4 whitespace-nowrap text-xs">
                          <a href={`/api/payroll/payslip/${p.id}`} target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: 'var(--indigo)' }}>View</a>
                          {p.delivered_at && <span className="ml-2 text-[var(--text-dim)]">· sent</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        ) : (
          <Card>
            <EmptyState
              icon={Wallet}
              title="No payroll runs yet"
              body="Run payroll to calculate PAYE, UIF and SDL for your active staff. Add team members first if you haven't — payslips are generated per active staff member with a salary."
              action={{ label: 'Run your first payroll', href: '?new=1' }}
              secondaryAction={{ label: 'Add staff', href: '/dashboard/staff' }}
            />
          </Card>
        )}

        {allRuns.length > 1 && (
          <Card padding="none">
            <div className="p-5 border-b border-[var(--border)]">
              <h3 className="font-semibold text-[var(--text-primary)]">Payroll history</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--surface-2)]">
                    {['Period', 'Gross', 'Net', 'Status', 'Actions'].map((h) => (
                      <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {allRuns.map((run) => (
                    <tr key={run.id} className="hover:bg-[var(--surface-hover)] transition-colors">
                      <td className="px-5 py-3 font-medium text-[var(--text-primary)]">{run.period_month}/{run.period_year}</td>
                      <td className="px-5 py-3 font-semibold text-[var(--text-primary)]">{formatZAR(Number(run.total_gross || 0))}</td>
                      <td className="px-5 py-3 text-emerald-600">{formatZAR(Number(run.total_net || 0))}</td>
                      <td className="px-5 py-3">
                        <Badge variant={statusVariant[run.status] || 'gray'}>{statusLabel[run.status] ?? run.status}</Badge>
                      </td>
                      <td className="px-5 py-3">
                        <PayrollRunActions compact runId={run.id} status={run.status}
                          periodMonth={run.period_month} periodYear={run.period_year}
                          payslipCount={run.id === latestRun?.id ? payslips.length : undefined} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
