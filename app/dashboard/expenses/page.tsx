import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { TopBar } from '@/components/dashboard/TopBar'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ConfirmSubmit } from '@/components/ui/ConfirmSubmit'
import { CreateExpenseModal } from './CreateExpenseModal'
import { EmptyState } from '@/components/ui/EmptyState'
import { redirect } from 'next/navigation'
import { Receipt, Clock, CheckCircle } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function ExpensesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const tenantId = user.app_metadata?.tenant_id as string

  // Reads `expenses` — the table the /api/expenses routes write to. (The page
  // previously read a non-existent `expense_claims` table, so the approval queue
  // was always empty and approve/reject was unreachable.) `expenses` has no
  // `currency` column; amounts are ZAR.
  const [pendingResult, allResult] = await Promise.all([
    supabaseAdmin
      .from('expenses')
      .select('id, staff_id, amount, category, description, receipt_url, status, submitted_at, staff(full_name)')
      .eq('tenant_id', tenantId)
      .eq('status', 'pending')
      .order('submitted_at', { ascending: false }),
    supabaseAdmin
      .from('expenses')
      .select('id, staff_id, amount, category, description, status, submitted_at, approved_at, approved_by, staff(full_name)')
      .eq('tenant_id', tenantId)
      .neq('status', 'pending')
      .order('submitted_at', { ascending: false })
      .limit(20),
  ])

  const pending = pendingResult.data || []
  const processed = allResult.data || []

  // Active staff for the "New claim" dropdown.
  const { data: staffRows } = await supabaseAdmin
    .from('staff')
    .select('id, full_name')
    .eq('tenant_id', tenantId)
    .eq('active', true)
    .order('full_name')
  const staff = (staffRows || []) as { id: string; full_name: string | null }[]

  const totalPendingAmount = pending.reduce((sum, c) => sum + Number(c.amount), 0)

  const categoryColors: Record<string, 'blue' | 'green' | 'yellow' | 'purple' | 'gray'> = {
    travel: 'blue',
    meals: 'green',
    equipment: 'purple',
    accommodation: 'yellow',
    other: 'gray',
  }

  return (
    <div>
      <TopBar
        title="Expense Claims"
        subtitle={`${pending.length} pending approval`}
        actions={<CreateExpenseModal staff={staff} />}
      />
      <div className="p-6 space-y-6">

        {/* Summary stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(245,158,11,0.15)' }}>
                <Clock className="w-5 h-5" style={{ color: '#F59E0B' }} />
              </div>
              <div>
                <p className="text-2xl font-bold text-[var(--text-primary)]">{pending.length}</p>
                <p className="text-xs text-[var(--text-muted)]">Pending Claims</p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.15)' }}>
                <Receipt className="w-5 h-5" style={{ color: '#F87171' }} />
              </div>
              <div>
                <p className="text-2xl font-bold text-[var(--text-primary)]">
                  R{totalPendingAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-[var(--text-muted)]">Total Amount Pending</p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(34,197,94,0.15)' }}>
                <CheckCircle className="w-5 h-5" style={{ color: '#34D399' }} />
              </div>
              <div>
                <p className="text-2xl font-bold text-[var(--text-primary)]">{processed.length}</p>
                <p className="text-xs text-[var(--text-muted)]">Processed (Recent 20)</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Pending claims queue */}
        <Card>
          <h3 className="font-semibold text-[var(--text-primary)] mb-4">
            Pending Approval Queue
            {pending.length > 0 && (
              <span className="ml-2 text-xs font-normal text-[var(--text-muted)]">
                — {pending.length} claim{pending.length !== 1 ? 's' : ''}
              </span>
            )}
          </h3>

          {pending.length === 0 ? (
            processed.length === 0 ? (
              <EmptyState
                icon={Receipt}
                title="No expense claims yet"
                body="Log a claim when a staff member spends their own money — you approve it here and it lands in the audit trail for reimbursement."
                action={{ label: 'Log the first claim', href: '?new=1' }}
              />
            ) : (
              <div className="text-center py-10 text-[var(--text-dim)]">
                <p className="text-3xl mb-2">✅</p>
                <p className="text-sm">No pending expense claims. All caught up!</p>
              </div>
            )
          ) : (
            <div className="space-y-3">
              {pending.map((claim) => {
                const staffName = (claim.staff as unknown as { full_name: string } | null)?.full_name || 'Staff member'
                const catVariant = categoryColors[claim.category?.toLowerCase()] ?? 'gray'
                const submittedDate = claim.submitted_at
                  ? new Date(claim.submitted_at).toLocaleDateString('en-ZA', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })
                  : 'Unknown date'

                return (
                  <div
                    key={claim.id}
                    className="flex items-start justify-between gap-4 p-4 bg-[var(--surface-2)] rounded-xl border border-[var(--border)]"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="text-sm font-semibold text-[var(--text-primary)]">{staffName}</p>
                        <Badge variant={catVariant} className="capitalize">
                          {claim.category || 'Other'}
                        </Badge>
                      </div>
                      <p className="text-xs text-[var(--text-muted)] mb-1 line-clamp-2">
                        {claim.description || 'No description provided'}
                      </p>
                      <p className="text-xs text-[var(--text-dim)]">Submitted {submittedDate}</p>
                      {claim.receipt_url && (
                        <a
                          href={claim.receipt_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-indigo-600 hover:underline mt-1 inline-block"
                        >
                          View Receipt &rarr;
                        </a>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-3 shrink-0">
                      <p className="text-base font-bold text-[var(--text-primary)]">
                        R{Number(claim.amount).toLocaleString('en-ZA', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </p>
                      <div className="flex gap-2">
                        <form action={`/api/expenses/${claim.id}/approve`} method="POST">
                          <input type="hidden" name="action" value="approve" />
                          <ConfirmSubmit
                            label="Approve"
                            title="Approve this expense claim?"
                            description="This approves the claim for reimbursement and is recorded in the audit trail."
                            confirmLabel="Approve claim"
                            className="text-xs bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-700 font-medium"
                          />
                        </form>
                        <form action={`/api/expenses/${claim.id}/approve`} method="POST">
                          <input type="hidden" name="action" value="reject" />
                          <ConfirmSubmit
                            label="Reject"
                            variant="danger"
                            title="Reject this expense claim?"
                            description="This rejects the claim. The staff member will need to resubmit if this was a mistake."
                            confirmLabel="Reject claim"
                            className="text-xs bg-[rgba(239,68,68,0.12)] text-[#F87171] border border-[rgba(239,68,68,0.3)] px-3 py-1.5 rounded-lg hover:bg-[rgba(239,68,68,0.2)] font-medium"
                          />
                        </form>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>

        {/* Processed claims */}
        {processed.length > 0 && (
          <Card>
            <h3 className="font-semibold text-[var(--text-primary)] mb-4">Recently Processed</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-[var(--text-muted)] border-b border-[var(--border)]">
                    <th className="pb-2 font-medium">Staff</th>
                    <th className="pb-2 font-medium">Category</th>
                    <th className="pb-2 font-medium">Amount</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium">Submitted</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {processed.map((claim) => {
                    const staffName = (claim.staff as unknown as { full_name: string } | null)?.full_name || 'Staff'
                    return (
                      <tr key={claim.id} className="hover:bg-[var(--surface-hover)]">
                        <td className="py-2 font-medium text-[var(--text-primary)]">{staffName}</td>
                        <td className="py-2 capitalize text-[var(--text-muted)]">{claim.category || 'Other'}</td>
                        <td className="py-2 font-medium text-[var(--text-primary)]">
                          R{Number(claim.amount).toLocaleString('en-ZA', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        <td className="py-2">
                          <Badge variant={claim.status === 'approved' ? 'green' : 'red'} className="capitalize">
                            {claim.status}
                          </Badge>
                        </td>
                        <td className="py-2 text-[var(--text-muted)] text-xs">
                          {claim.submitted_at
                            ? new Date(claim.submitted_at).toLocaleDateString('en-ZA')
                            : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
