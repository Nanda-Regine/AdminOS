import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { TopBar } from '@/components/dashboard/TopBar'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ConfirmSubmit } from '@/components/ui/ConfirmSubmit'
import { redirect } from 'next/navigation'

const statusVariant: Record<string, 'gray' | 'yellow' | 'green' | 'blue'> = {
  draft: 'gray',
  processing: 'yellow',
  completed: 'green',
  distributed: 'blue',
}

export default async function PayrollPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const tenantId = user.app_metadata?.tenant_id as string

  const { data: runs } = await supabaseAdmin
    .from('payroll_runs')
    .select('id, tenant_id, period_month, period_year, status, total_gross, total_net, created_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(12)

  const allRuns = runs || []
  const latestRun = allRuns[0] || null

  return (
    <div>
      <TopBar title="Payroll" subtitle="Manage payroll runs and payslips" />
      <div className="p-6 space-y-6">

        {/* Latest run status */}
        {latestRun ? (
          <Card>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-[var(--text-muted)] mb-1">Current / Latest Run</p>
                <h3 className="font-semibold text-[var(--text-primary)] text-lg">
                  {latestRun.period_month}/{latestRun.period_year}
                </h3>
                <div className="mt-2 flex items-center gap-3">
                  <Badge variant={statusVariant[latestRun.status] || 'gray'}>
                    {latestRun.status}
                  </Badge>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-[var(--text-dim)]">Gross / Net</p>
                <p className="text-xl font-bold text-[var(--text-primary)] mt-0.5">
                  R{Number(latestRun.total_gross || 0).toLocaleString()}
                </p>
                <p className="text-sm text-emerald-600">
                  R{Number(latestRun.total_net || 0).toLocaleString()} net
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <form action={`/api/payroll/${latestRun.id}/generate-payslips`} method="POST">
                <button
                  type="submit"
                  className="text-sm bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors"
                >
                  Generate Payslips
                </button>
              </form>
              <form action={`/api/payroll/${latestRun.id}/distribute`} method="POST">
                <ConfirmSubmit
                  label="Distribute"
                  title="Distribute payslips?"
                  description="This sends payslips to every staff member on this run and marks it distributed. This can't be undone."
                  confirmLabel="Yes, distribute"
                  className="text-sm bg-[var(--indigo)] text-white px-4 py-2 rounded-lg hover:opacity-90 transition-colors"
                />
              </form>
              <a
                href="/api/payroll/emp201"
                className="text-sm border border-[var(--border)] text-[var(--text-secondary)] px-4 py-2 rounded-lg hover:bg-[var(--surface-hover)] transition-colors"
              >
                Download EMP201
              </a>
            </div>
          </Card>
        ) : (
          <Card>
            <p className="text-center text-[var(--text-dim)] py-6 text-sm">
              No payroll runs found. Create your first payroll run to get started.
            </p>
          </Card>
        )}

        {/* Summary stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <p className="text-xs text-[var(--text-muted)]">Total Runs</p>
            <p className="text-2xl font-bold text-[var(--text-primary)] mt-1">{allRuns.length}</p>
          </Card>
          <Card>
            <p className="text-xs text-[var(--text-muted)]">Completed</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">
              {allRuns.filter(r => r.status === 'completed' || r.status === 'distributed').length}
            </p>
          </Card>
          <Card>
            <p className="text-xs text-[var(--text-muted)]">Processing</p>
            <p className="text-2xl font-bold text-yellow-600 mt-1">
              {allRuns.filter(r => r.status === 'processing').length}
            </p>
          </Card>
          <Card>
            <p className="text-xs text-[var(--text-muted)]">Drafts</p>
            <p className="text-2xl font-bold text-[var(--text-muted)] mt-1">
              {allRuns.filter(r => r.status === 'draft').length}
            </p>
          </Card>
        </div>

        {/* History table */}
        <Card padding="none">
          <div className="p-5 border-b border-[var(--border)]">
            <h3 className="font-semibold text-[var(--text-primary)]">Payroll History</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--surface-2)]">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Period</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Staff</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Gross</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Net</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Status</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {allRuns.map((run) => (
                  <tr key={run.id} className="hover:bg-[var(--surface-hover)] transition-colors">
                    <td className="px-5 py-3">
                      <p className="font-medium text-[var(--text-primary)]">{run.period_month}/{run.period_year}</p>
                      <p className="text-xs text-[var(--text-dim)]">{run.created_at?.slice(0, 10)}</p>
                    </td>
                    <td className="px-5 py-3 text-[var(--text-muted)]">—</td>
                    <td className="px-5 py-3 font-semibold text-[var(--text-primary)]">
                      R{Number(run.total_gross || 0).toLocaleString()}
                    </td>
                    <td className="px-5 py-3 text-emerald-600">
                      R{Number(run.total_net || 0).toLocaleString()}
                    </td>
                    <td className="px-5 py-3">
                      <Badge variant={statusVariant[run.status] || 'gray'}>
                        {run.status}
                      </Badge>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex gap-2">
                        <form action={`/api/payroll/${run.id}/generate-payslips`} method="POST">
                          <button type="submit" className="text-xs text-emerald-700 hover:underline">
                            Payslips
                          </button>
                        </form>
                        <form action={`/api/payroll/${run.id}/distribute`} method="POST">
                          <ConfirmSubmit
                            label="Distribute"
                            title="Distribute payslips?"
                            description="This sends payslips to every staff member on this run and marks it distributed. This can't be undone."
                            confirmLabel="Yes, distribute"
                            className="text-xs text-[var(--indigo-light)] hover:underline"
                          />
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
                {allRuns.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center text-[var(--text-dim)]">
                      No payroll runs yet. Create your first run to get started.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  )
}
