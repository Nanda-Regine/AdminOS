import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { TopBar } from '@/components/dashboard/TopBar'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { redirect } from 'next/navigation'
import { CreateInvoiceModal } from './CreateInvoiceModal'
import { RecoveryReviewQueue } from '@/components/invoices/RecoveryReviewQueue'

const statusVariant: Record<string, 'green' | 'yellow' | 'red' | 'gray' | 'blue'> = {
  paid: 'green',
  partial: 'yellow',
  unpaid: 'red',
  in_collections: 'purple' as 'gray',
}

// Recovery tier the engine last evaluated (recovery_tier). Tiers 1–3 auto-send;
// 4+ stop for owner review (surfaced in RecoveryReviewQueue).
const tierLabel: Record<number, string> = {
  0: 'No reminder',
  1: 'Reminder sent',
  2: 'Follow-up sent',
  3: 'Firm notice sent',
  4: 'Awaiting your review',
  5: 'Awaiting your review',
  6: 'Awaiting your review',
}

function recoveryLabel(inv: { recovery_tier?: number | null; recovery_status?: string | null; escalation_level?: number | null }): string {
  if (inv.recovery_status === 'paused') return 'Paused'
  if (inv.recovery_status === 'owner_approved') return 'Handled by you'
  const tier = inv.recovery_tier ?? inv.escalation_level ?? 0
  return tierLabel[tier] ?? '—'
}

export default async function InvoicesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const tenantId = user.app_metadata?.tenant_id as string

  const { data: contacts } = await supabaseAdmin
    .from('contacts')
    .select('id, full_name')
    .eq('tenant_id', tenantId)
    .order('full_name')
    .limit(100)

  const { data: invoices } = await supabaseAdmin
    .from('invoices')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('days_overdue', { ascending: false })

  const allInvoices = invoices || []
  const totalOwed = allInvoices
    .filter((i) => i.status !== 'paid')
    .reduce((sum, i) => sum + Number(i.amount) - Number(i.amount_paid), 0)
  const overdueCount = allInvoices.filter((i) => (i.days_overdue || 0) > 0 && i.status !== 'paid').length

  return (
    <div>
      <TopBar title="Invoices" subtitle="Debt register and recovery" actions={<CreateInvoiceModal contacts={contacts || []} />} />
      <div className="p-6 space-y-6">

        {/* Summary */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <p className="text-sm text-[var(--text-muted)]">Total outstanding</p>
            <p className="text-2xl font-bold text-[var(--text-primary)] mt-1">R{totalOwed.toLocaleString()}</p>
          </Card>
          <Card>
            <p className="text-sm text-[var(--text-muted)]">Overdue invoices</p>
            <p className="text-2xl font-bold text-red-600 mt-1">{overdueCount}</p>
          </Card>
          <Card>
            <p className="text-sm text-[var(--text-muted)]">Total invoices</p>
            <p className="text-2xl font-bold text-[var(--text-primary)] mt-1">{allInvoices.length}</p>
          </Card>
        </div>

        {/* Debt-recovery escalations awaiting the owner's decision (hidden when empty) */}
        <RecoveryReviewQueue />

        {/* Invoice table */}
        <Card padding="none">
          <div className="p-5 border-b border-[var(--border)]">
            <h3 className="font-semibold text-[var(--text-primary)]">All Invoices</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--surface-2)]">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Contact</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Amount</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Due Date</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Overdue</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Status</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Recovery</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {allInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-[var(--surface-hover)] transition-colors">
                    <td className="px-5 py-3">
                      <p className="font-medium text-[var(--text-primary)]">{inv.contact_name || '(Unknown)'}</p>
                      <p className="text-xs text-[var(--text-dim)]">{inv.contact_email || inv.contact_phone}</p>
                    </td>
                    <td className="px-5 py-3">
                      <p className="font-semibold text-[var(--text-primary)]">R{Number(inv.amount).toLocaleString()}</p>
                      {Number(inv.amount_paid) > 0 && (
                        <p className="text-xs text-emerald-600">R{Number(inv.amount_paid).toLocaleString()} paid</p>
                      )}
                    </td>
                    <td className="px-5 py-3 text-[var(--text-muted)]">{inv.due_date || '—'}</td>
                    <td className="px-5 py-3">
                      {(inv.days_overdue || 0) > 0 ? (
                        <span className="text-red-600 font-medium">{inv.days_overdue} days</span>
                      ) : (
                        <span className="text-[var(--text-dim)]">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <Badge variant={statusVariant[inv.status] || 'gray'}>
                        {inv.status.replace('_', ' ')}
                      </Badge>
                    </td>
                    <td className="px-5 py-3 text-xs text-[var(--text-muted)]">
                      {recoveryLabel(inv)}
                    </td>
                  </tr>
                ))}
                {allInvoices.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center text-[var(--text-dim)]">
                      No invoices found. Upload an invoice document or add one manually.
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
