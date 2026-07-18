'use client'

import { Badge } from '@/components/ui/badge'
import { DataTable, type Column, type FilterDef } from '@/components/ui/DataTable'
import { formatZAR } from '@/lib/format'

export type InvoiceRow = {
  id:               string
  contact_name:     string | null
  contact_email:    string | null
  contact_phone:    string | null
  amount:           number
  amount_paid:      number
  due_date:         string | null
  days_overdue:     number | null
  status:           string
  recovery_tier?:   number | null
  recovery_status?: string | null
  escalation_level?: number | null
}

const statusVariant: Record<string, 'green' | 'yellow' | 'red' | 'gray' | 'blue' | 'purple'> = {
  paid: 'green',
  partial: 'yellow',
  unpaid: 'red',
  in_collections: 'purple',
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
  if (inv.recovery_status === 'paused') return 'Paused'
  if (inv.recovery_status === 'owner_approved') return 'Handled by you'
  const tier = inv.recovery_tier ?? inv.escalation_level ?? 0
  return tierLabel[tier] ?? '—'
}

/** Outstanding = amount − paid, floored at 0. */
function outstanding(inv: InvoiceRow): number {
  return Math.max(0, Number(inv.amount || 0) - Number(inv.amount_paid || 0))
}

export function InvoicesTable({ rows }: { rows: InvoiceRow[] }) {
  const columns: Column<InvoiceRow>[] = [
    {
      key: 'contact_name',
      header: 'Contact',
      accessor: i => i.contact_name || '(Unknown)',
      render: i => (
        <div>
          <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{i.contact_name || '(Unknown)'}</p>
          <p className="text-xs" style={{ color: 'var(--text-dim)' }}>{i.contact_email || i.contact_phone || ''}</p>
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
      accessor: i => outstanding(i),
      csv: i => outstanding(i),
      render: i => {
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
      header: 'Due Date',
      accessor: i => i.due_date ?? '',
      render: i => <span style={{ color: 'var(--text-muted)' }}>{i.due_date || '—'}</span>,
    },
    {
      key: 'days_overdue',
      header: 'Overdue',
      numeric: true,
      accessor: i => Number(i.days_overdue || 0),
      csv: i => Number(i.days_overdue || 0),
      render: i =>
        (i.days_overdue || 0) > 0 ? (
          <span className="font-medium" style={{ color: '#F87171' }}>{i.days_overdue} days</span>
        ) : (
          <span style={{ color: 'var(--text-dim)' }}>—</span>
        ),
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
  ]

  const filters: FilterDef<InvoiceRow>[] = [
    {
      key: 'status',
      label: 'Status',
      options: [
        { value: 'unpaid', label: 'Unpaid' },
        { value: 'partial', label: 'Partial' },
        { value: 'paid', label: 'Paid' },
        { value: 'in_collections', label: 'In collections' },
      ],
      predicate: (i, v) => i.status === v,
    },
    {
      key: 'overdue',
      label: 'Overdue',
      options: [
        { value: 'yes', label: 'Overdue only' },
        { value: 'no', label: 'On time' },
      ],
      predicate: (i, v) => (v === 'yes' ? (i.days_overdue || 0) > 0 : (i.days_overdue || 0) <= 0),
    },
  ]

  return (
    <DataTable<InvoiceRow>
      rows={rows}
      columns={columns}
      filters={filters}
      getRowKey={i => i.id}
      searchPlaceholder="Search contact, email, phone…"
      initialSort={{ key: 'days_overdue', dir: 'desc' }}
      csvFilename="invoices.csv"
      pageSize={25}
      emptyState={
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          No invoices found. Upload an invoice document or add one manually.
        </p>
      }
      renderFooter={fr => {
        const totalAmount = fr.reduce((s, i) => s + Number(i.amount || 0), 0)
        const totalOut = fr.reduce((s, i) => s + outstanding(i), 0)
        return (
          <>
            <td className="px-5 py-3 text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
              {fr.length} invoice{fr.length === 1 ? '' : 's'}
            </td>
            <td className="px-5 py-3 text-right tabular-nums" style={{ color: 'var(--text-primary)' }}>
              {formatZAR(totalAmount)}
            </td>
            <td className="px-5 py-3 text-right tabular-nums" style={{ color: '#F87171' }}>
              {formatZAR(totalOut)}
            </td>
            <td className="px-5 py-3" colSpan={4} />
          </>
        )
      }}
    />
  )
}
