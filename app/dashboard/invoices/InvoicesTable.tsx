'use client'

import { FileText } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { DataTable, type Column, type FilterDef } from '@/components/ui/DataTable'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatZAR } from '@/lib/format'
import { daysOverdue } from '@/lib/debt/overdue'
import { isOpen, outstanding } from '@/lib/invoices/status'
import type { ListResult } from '@/lib/api/list'
import { InvoiceActions } from './InvoiceActions'

export type InvoiceRow = {
  id:               string
  invoice_number:   string | null
  contact_name:     string | null
  contact_email:    string | null
  contact_phone:    string | null
  amount:           number
  amount_paid:      number
  due_date:         string | null
  status:           string
  recovery_tier?:   number | null
  recovery_status?: string | null
  escalation_level?: number | null
}

const statusVariant: Record<string, 'green' | 'yellow' | 'red' | 'gray' | 'blue' | 'purple'> = {
  paid: 'green',
  partial: 'yellow',
  sent: 'blue',
  unpaid: 'red',
  overdue: 'red',
  in_collections: 'purple',
  draft: 'gray',
  cancelled: 'gray',
}

const tierLabel: Record<number, string> = {
  0: 'No reminder',
  1: 'Reminder sent',
  2: 'Follow-up sent',
  3: 'Firm notice sent',
  4: 'Awaiting your review',
  5: 'Awaiting your review',
  6: 'Awaiting your review',
}

function recoveryLabel(inv: InvoiceRow): string {
  if (!isOpen(inv.status)) return '—'
  if (inv.recovery_status === 'paused') return 'Paused'
  if (inv.recovery_status === 'owner_approved') return 'Handled by you'
  const tier = inv.recovery_tier ?? inv.escalation_level ?? 0
  return tierLabel[tier] ?? '—'
}

/** Days late, computed from due_date (the stored days_overdue column goes stale). */
function lateDays(inv: InvoiceRow): number {
  return isOpen(inv.status) ? daysOverdue(inv.due_date) : 0
}

const label = (i: InvoiceRow) => i.invoice_number ?? `Invoice for ${i.contact_name ?? 'customer'}`

export function InvoicesTable({ rows, server }: { rows: InvoiceRow[]; server: Omit<ListResult<unknown>, 'rows'> }) {
  const columns: Column<InvoiceRow>[] = [
    {
      key: 'contact_name',
      header: 'Contact',
      accessor: i => i.contact_name || '(Unknown)',
      render: i => (
        <div>
          <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{i.contact_name || '(Unknown)'}</p>
          <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
            {[i.invoice_number, i.contact_email || i.contact_phone].filter(Boolean).join(' · ')}
          </p>
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      numeric: true,
      accessor: i => Number(i.amount || 0),
      csv: i => Number(i.amount || 0),
      render: i => (
        <div>
          <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{formatZAR(i.amount)}</p>
          {Number(i.amount_paid) > 0 && (
            <p className="text-xs" style={{ color: '#34D399' }}>{formatZAR(i.amount_paid)} paid</p>
          )}
        </div>
      ),
    },
    {
      key: 'outstanding',
      header: 'Outstanding',
      numeric: true,
      sortable: false,
      accessor: i => outstanding(i),
      csv: i => outstanding(i),
      render: i => {
        if (i.status === 'cancelled') return <span className="text-xs" style={{ color: 'var(--text-dim)' }}>Cancelled</span>
        const o = outstanding(i)
        return o > 0 ? (
          <span className="font-semibold" style={{ color: '#F87171' }}>{formatZAR(o)}</span>
        ) : (
          <span className="text-xs" style={{ color: '#22C55E' }}>Settled</span>
        )
      },
    },
    {
      key: 'due_date',
      header: 'Due',
      accessor: i => i.due_date ?? '',
      render: i => {
        const late = lateDays(i)
        return (
          <div>
            <p style={{ color: 'var(--text-muted)' }}>{i.due_date || '—'}</p>
            {late > 0 && <p className="text-xs font-medium" style={{ color: '#F87171' }}>{late} days late</p>}
          </div>
        )
      },
    },
    {
      key: 'status',
      header: 'Status',
      accessor: i => i.status,
      csv: i => i.status,
      render: i => <Badge variant={statusVariant[i.status] || 'gray'}>{i.status.replace('_', ' ')}</Badge>,
    },
    {
      key: 'recovery',
      header: 'Recovery',
      sortable: false,
      accessor: i => recoveryLabel(i),
      csv: i => recoveryLabel(i),
      render: i => <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{recoveryLabel(i)}</span>,
    },
    {
      key: 'actions',
      header: 'Actions',
      sortable: false,
      render: i => (
        <div className="flex flex-col gap-1.5 text-xs">
          <InvoiceActions id={i.id} status={i.status} amount={Number(i.amount || 0)}
            amountPaid={Number(i.amount_paid || 0)} label={label(i)} />
          <div className="flex items-center gap-3 whitespace-nowrap">
            <a href={`/api/invoices/${i.id}/document`} target="_blank" rel="noopener noreferrer"
              className="hover:underline" style={{ color: 'var(--indigo)' }}>
              Invoice
            </a>
            {Number(i.amount_paid) > 0 && (
              <a href={`/api/invoices/${i.id}/receipt`} target="_blank" rel="noopener noreferrer"
                className="hover:underline" style={{ color: '#22C55E' }}>
                Receipt
              </a>
            )}
          </div>
        </div>
      ),
    },
  ]

  // Server mode: predicates are unused — the page filters in the query.
  const filters: FilterDef<InvoiceRow>[] = [
    {
      key: 'status',
      label: 'Status',
      options: [
        { value: 'sent', label: 'Sent' },
        { value: 'unpaid', label: 'Unpaid' },
        { value: 'partial', label: 'Part paid' },
        { value: 'paid', label: 'Paid' },
        { value: 'draft', label: 'Draft' },
        { value: 'in_collections', label: 'In collections' },
        { value: 'cancelled', label: 'Cancelled' },
      ],
      predicate: (i, v) => i.status === v,
    },
    {
      key: 'overdue',
      label: 'Overdue',
      options: [
        { value: 'yes', label: 'Overdue only' },
        { value: 'no', label: 'Not overdue' },
      ],
      predicate: (i, v) => (v === 'yes' ? lateDays(i) > 0 : lateDays(i) === 0),
    },
  ]

  return (
    <DataTable<InvoiceRow>
      rows={rows}
      server={server}
      columns={columns}
      filters={filters}
      getRowKey={i => i.id}
      searchPlaceholder="Search contact, invoice no., email, phone…"
      csvFilename="invoices.csv"
      emptyState={
        <EmptyState
          icon={FileText}
          title={server.q || Object.keys(server.filters).length ? 'No matching invoices' : 'No invoices yet'}
          body={server.q || Object.keys(server.filters).length
            ? 'Try a different search or clear the filters.'
            : 'Raise your first invoice to start tracking who owes you — overdue ones flow straight into recovery.'}
          action={{ label: 'New invoice', href: '?new=1' }}
          compact
        />
      }
    />
  )
}
