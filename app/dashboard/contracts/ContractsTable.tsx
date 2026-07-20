'use client'

import { FileSignature } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { DataTable, type Column, type FilterDef } from '@/components/ui/DataTable'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatZAR } from '@/lib/format'

export type ContractRow = {
  id:          string
  title:       string
  contact_id:  string | null
  status:      string
  value:       number | null
  signed_at:   string | null
  created_at:  string | null
  contacts:    { full_name: string; email?: string } | { full_name: string; email?: string }[] | null
}

const statusVariant: Record<string, 'gray' | 'yellow' | 'green' | 'red'> = {
  draft: 'gray',
  sent: 'yellow',
  signed: 'green',
  expired: 'red',
}

const titleCase = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)

/** contacts embed can arrive as an object or a single-element array. */
function contactOf(c: ContractRow): { full_name: string; email?: string } | null {
  const embed = c.contacts
  if (!embed) return null
  return Array.isArray(embed) ? embed[0] ?? null : embed
}

const dateZA = (d: string | null) => (d ? new Date(d).toLocaleDateString('en-ZA') : '')

export function ContractsTable({ rows }: { rows: ContractRow[] }) {
  const columns: Column<ContractRow>[] = [
    {
      key: 'title',
      header: 'Title',
      render: c => <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{c.title}</span>,
    },
    {
      key: 'contact',
      header: 'Contact',
      accessor: c => contactOf(c)?.full_name ?? '',
      csv: c => contactOf(c)?.full_name ?? '',
      render: c => {
        const contact = contactOf(c)
        return contact ? (
          <div>
            <p style={{ color: 'var(--text-primary)' }}>{contact.full_name}</p>
            {contact.email && <p className="text-xs" style={{ color: 'var(--text-dim)' }}>{contact.email}</p>}
          </div>
        ) : (
          <span style={{ color: 'var(--text-dim)' }}>—</span>
        )
      },
    },
    {
      key: 'status',
      header: 'Status',
      accessor: c => c.status,
      csv: c => titleCase(c.status),
      render: c => <Badge variant={statusVariant[c.status] || 'gray'}>{titleCase(c.status)}</Badge>,
    },
    {
      key: 'value',
      header: 'Value',
      numeric: true,
      accessor: c => Number(c.value || 0),
      csv: c => Number(c.value || 0),
      render: c =>
        c.value != null ? (
          <span style={{ color: 'var(--text-primary)' }}>{formatZAR(c.value)}</span>
        ) : (
          <span style={{ color: 'var(--text-dim)' }}>—</span>
        ),
    },
    {
      key: 'created_at',
      header: 'Created',
      accessor: c => c.created_at ?? '',
      csv: c => dateZA(c.created_at),
      render: c => <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{dateZA(c.created_at) || '—'}</span>,
    },
    {
      key: 'signed_at',
      header: 'Signed',
      accessor: c => c.signed_at ?? '',
      csv: c => dateZA(c.signed_at),
      render: c =>
        c.signed_at ? (
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{dateZA(c.signed_at)}</span>
        ) : (
          <span style={{ color: 'var(--text-dim)' }}>—</span>
        ),
    },
  ]

  const filters: FilterDef<ContractRow>[] = [
    {
      key: 'status',
      label: 'Status',
      options: [
        { value: 'draft', label: 'Draft' },
        { value: 'sent', label: 'Sent' },
        { value: 'signed', label: 'Signed' },
        { value: 'expired', label: 'Expired' },
      ],
      predicate: (c, v) => c.status === v,
    },
  ]

  return (
    <DataTable<ContractRow>
      rows={rows}
      columns={columns}
      filters={filters}
      getRowKey={c => c.id}
      searchPlaceholder="Search title, contact, signer…"
      searchExtra={c => contactOf(c)?.email ?? ''}
      initialSort={{ key: 'created_at', dir: 'desc' }}
      csvFilename="contracts.csv"
      pageSize={25}
      emptyState={
        <EmptyState
          icon={FileSignature}
          title="No contracts yet"
          body="Draft, send, and track agreements so nothing sits unsigned. Create your first contract to get started."
          action={{ label: 'New contract', href: '?new=1' }}
          compact
        />
      }
    />
  )
}
