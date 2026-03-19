import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { TopBar } from '@/components/dashboard/TopBar'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { redirect } from 'next/navigation'

const statusVariant: Record<string, 'green' | 'yellow' | 'red' | 'gray' | 'blue'> = {
  paid: 'green',
  partial: 'yellow',
  unpaid: 'red',
  in_collections: 'purple' as 'gray',
}

const escalationLabel: Record<number, string> = {
  0: 'No reminder',
  1: 'Day 1 sent',
  2: 'Day 3 sent',
  3: 'Day 7 sent',
  4: 'Day 14 sent',
  5: 'Demand letter',
}

export default async function InvoicesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const tenantId = user.user_metadata?.tenant_id as string

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
      <TopBar title="Invoices" subtitle="Debt register and recovery" />
      <div className="p-6 space-y-6">

        {/* Summary */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <p className="text-sm text-gray-500">Total outstanding</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">R{totalOwed.toLocaleString()}</p>
          </Card>
          <Card>
            <p className="text-sm text-gray-500">Overdue invoices</p>
            <p className="text-2xl font-bold text-red-600 mt-1">{overdueCount}</p>
          </Card>
          <Card>
            <p className="text-sm text-gray-500">Total invoices</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{allInvoices.length}</p>
          </Card>
        </div>

        {/* Invoice table */}
        <Card padding="none">
          <div className="p-5 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">All Invoices</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Contact</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Amount</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Due Date</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Overdue</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Recovery</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {allInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3">
                      <p className="font-medium text-gray-900">{inv.contact_name}</p>
                      <p className="text-xs text-gray-400">{inv.contact_email || inv.contact_phone}</p>
                    </td>
                    <td className="px-5 py-3">
                      <p className="font-semibold text-gray-900">R{Number(inv.amount).toLocaleString()}</p>
                      {Number(inv.amount_paid) > 0 && (
                        <p className="text-xs text-emerald-600">R{Number(inv.amount_paid).toLocaleString()} paid</p>
                      )}
                    </td>
                    <td className="px-5 py-3 text-gray-600">{inv.due_date || '—'}</td>
                    <td className="px-5 py-3">
                      {(inv.days_overdue || 0) > 0 ? (
                        <span className="text-red-600 font-medium">{inv.days_overdue} days</span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <Badge variant={statusVariant[inv.status] || 'gray'}>
                        {inv.status.replace('_', ' ')}
                      </Badge>
                    </td>
                    <td className="px-5 py-3 text-xs text-gray-500">
                      {escalationLabel[inv.escalation_level] || '—'}
                    </td>
                  </tr>
                ))}
                {allInvoices.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center text-gray-400">
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
