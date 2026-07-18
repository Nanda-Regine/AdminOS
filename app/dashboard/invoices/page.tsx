import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { TopBar } from '@/components/dashboard/TopBar'
import { Card } from '@/components/ui/card'
import { redirect } from 'next/navigation'
import { CreateInvoiceModal } from './CreateInvoiceModal'
import { RecoveryReviewQueue } from '@/components/invoices/RecoveryReviewQueue'
import { InvoicesTable, type InvoiceRow } from './InvoicesTable'
import { formatZAR } from '@/lib/format'

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

  const allInvoices = (invoices || []) as InvoiceRow[]
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
            <p className="text-2xl font-bold text-[var(--text-primary)] mt-1">{formatZAR(totalOwed)}</p>
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
        <InvoicesTable rows={allInvoices} />
      </div>
    </div>
  )
}
