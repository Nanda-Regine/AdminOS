import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { TopBar } from '@/components/dashboard/TopBar'
import { Card } from '@/components/ui/card'
import { redirect, notFound } from 'next/navigation'
import { CreateInvoiceModal } from './CreateInvoiceModal'
import { QuickSaleModal } from './QuickSaleModal'
import { RecoveryReviewQueue } from '@/components/invoices/RecoveryReviewQueue'
import { InvoicesTable, type InvoiceRow } from './InvoicesTable'
import { formatZAR } from '@/lib/format'
import { checkPermission } from '@/lib/auth/permissions'
import { defaultIncomeKeyForBusinessType } from '@/lib/finance/chartOfAccounts'
import { parseListParams, applyList, listResult } from '@/lib/api/list'
import { fetchAll } from '@/lib/supabase/fetchAll'
import { INVOICE_STATUSES, OPEN_INVOICE_STATUSES, OWED_INVOICE_STATUSES, outstanding, isOpen } from '@/lib/invoices/status'
import { daysOverdue, todayDateString } from '@/lib/debt/overdue'

const COLUMNS =
  'id, invoice_number, contact_name, contact_email, contact_phone, amount, amount_paid, due_date, status, ' +
  'recovery_tier, recovery_status, escalation_level'

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // The full debt register — same manage_invoices boundary the API enforces.
  // notFound(), not a redirect, per the page-level denial convention.
  if (!(await checkPermission('manage_invoices'))) notFound()

  const tenantId = user.app_metadata?.tenant_id as string
  const sp = await searchParams

  // Paged on the server (lib/api/list): this read every invoice the tenant
  // ever raised, and PostgREST silently stops at 1000 rows.
  const p = parseListParams(sp, {
    sortable: ['created_at', 'due_date', 'amount', 'contact_name', 'status'],
    defaultSort: 'due_date',
    defaultDir: 'asc',
    filters: ['status'],
  })
  if (p.filters.status && !(INVOICE_STATUSES as readonly string[]).includes(p.filters.status)) delete p.filters.status
  const overdue = typeof sp.overdue === 'string' ? sp.overdue : ''
  const today = todayDateString()

  let listQ = supabaseAdmin
    .from('invoices')
    .select(COLUMNS, { count: 'exact' })
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
  if (overdue === 'yes') listQ = listQ.in('status', [...OPEN_INVOICE_STATUSES]).lt('due_date', today)
  if (overdue === 'no') listQ = listQ.or(`due_date.gte.${today},due_date.is.null,status.not.in.(${OPEN_INVOICE_STATUSES.join(',')})`)

  const [listRes, owed, { count: totalCount }, { data: contacts }, { data: products }, { data: tenant }] = await Promise.all([
    applyList(listQ, p, { search: ['contact_name', 'contact_email', 'contact_phone', 'invoice_number'] }),
    // Summary over everything still owed — narrow columns, paged past 1000.
    fetchAll<{ amount: number; amount_paid: number; due_date: string | null; status: string }>((from, to) =>
      supabaseAdmin.from('invoices').select('amount, amount_paid, due_date, status')
        .eq('tenant_id', tenantId).is('deleted_at', null).in('status', [...OWED_INVOICE_STATUSES])
        .order('id').range(from, to)),
    supabaseAdmin.from('invoices').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).is('deleted_at', null),
    supabaseAdmin.from('contacts').select('id, full_name').eq('tenant_id', tenantId).is('deleted_at', null).order('full_name').limit(100),
    supabaseAdmin.from('products').select('id, name, unit_price, current_stock').eq('tenant_id', tenantId).eq('active', true).is('deleted_at', null).order('name').limit(500),
    supabaseAdmin.from('tenants').select('business_type, settings').eq('id', tenantId).maybeSingle(),
  ])

  const rows = (listRes.data ?? []) as unknown as InvoiceRow[]
  const totalOwed = owed.reduce((sum, i) => sum + outstanding(i), 0)
  const overdueCount = owed.filter((i) => isOpen(i.status) && daysOverdue(i.due_date) > 0 && outstanding(i) > 0).length
  const vatRegistered = Boolean((tenant?.settings as { vat_number?: string } | null)?.vat_number?.trim())

  const { rows: _rows, ...server } = listResult(rows, listRes.count, p)
  void _rows
  if (overdue) server.filters = { ...server.filters, overdue }

  return (
    <div>
      <TopBar
        title="Invoices"
        subtitle="Debt register and recovery"
        actions={
          <div className="flex items-center gap-2">
            <QuickSaleModal
              contacts={contacts || []}
              products={products || []}
              defaultCategory={defaultIncomeKeyForBusinessType(tenant?.business_type)}
              vatRegistered={vatRegistered}
            />
            <CreateInvoiceModal contacts={contacts || []} vatRegistered={vatRegistered} />
          </div>
        }
      />
      <div className="p-4 md:p-6 space-y-6">

        {/* Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
            <p className="text-2xl font-bold text-[var(--text-primary)] mt-1">{totalCount ?? 0}</p>
          </Card>
        </div>

        {/* Debt-recovery escalations awaiting the owner's decision (hidden when empty) */}
        <RecoveryReviewQueue />

        {/* Invoice table */}
        <InvoicesTable rows={rows} server={server} />
      </div>
    </div>
  )
}
