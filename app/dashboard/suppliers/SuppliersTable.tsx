'use client'

import { Truck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { DataTable, type Column, type FilterDef } from '@/components/ui/DataTable'
import { EmptyState } from '@/components/ui/EmptyState'

export type SupplierRow = {
  id:                    string
  name:                  string
  category:              string | null
  contact_person:        string | null
  phone:                 string | null
  email:                 string | null
  payment_terms:         number
  rating:                number | null
  is_community_verified: boolean
  bbbbee_level:          number | null
  women_owned:           boolean
  youth_owned:           boolean
}

/**
 * B-BBEE levels 1-4 earn the buyer the strongest procurement recognition, 5-8
 * progressively less. Colouring by band lets an owner see their preferential
 * procurement position down the column without reading a single number.
 */
function bbbeeTone(level: number | null): 'green' | 'yellow' | 'gray' {
  if (level === null) return 'gray'
  if (level <= 4) return 'green'
  return 'yellow'
}

export function SuppliersTable({ rows }: { rows: SupplierRow[] }) {
  const categories = Array.from(new Set(rows.map(r => r.category).filter(Boolean))) as string[]

  const columns: Column<SupplierRow>[] = [
    {
      key: 'name',
      header: 'Supplier',
      accessor: r => r.name,
      render: r => (
        <div className="min-w-0">
          <div className="font-medium truncate" style={{ color: 'var(--text-primary)' }}>{r.name}</div>
          {r.contact_person && (
            <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{r.contact_person}</div>
          )}
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      accessor: r => r.category ?? '',
      render: r => <Badge variant="gray">{r.category || 'Uncategorised'}</Badge>,
    },
    {
      key: 'bbbbee_level',
      header: 'B-BBEE',
      accessor: r => r.bbbbee_level ?? 99,
      csv: r => r.bbbbee_level ?? '',
      render: r =>
        r.bbbbee_level === null
          ? <span className="text-xs" style={{ color: 'var(--text-dim)' }}>Not recorded</span>
          : <Badge variant={bbbeeTone(r.bbbbee_level)}>Level {r.bbbbee_level}</Badge>,
    },
    {
      key: 'ownership',
      header: 'Ownership',
      accessor: r => [r.women_owned && 'women', r.youth_owned && 'youth', r.is_community_verified && 'community']
        .filter(Boolean).join(' '),
      render: r => (
        <div className="flex flex-wrap gap-1">
          {r.women_owned && <Badge variant="purple">Women-owned</Badge>}
          {r.youth_owned && <Badge variant="blue">Youth-owned</Badge>}
          {r.is_community_verified && <Badge variant="green">Community</Badge>}
          {!r.women_owned && !r.youth_owned && !r.is_community_verified && (
            <span className="text-xs" style={{ color: 'var(--text-dim)' }}>—</span>
          )}
        </div>
      ),
    },
    {
      key: 'payment_terms',
      header: 'Terms',
      numeric: true,
      accessor: r => Number(r.payment_terms),
      render: r => (
        <span className="whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
          {r.payment_terms} days
        </span>
      ),
    },
    {
      key: 'contact',
      header: 'Contact',
      accessor: r => `${r.phone ?? ''} ${r.email ?? ''}`,
      render: r => (
        <div className="text-xs min-w-0" style={{ color: 'var(--text-muted)' }}>
          {r.phone && <div className="truncate">{r.phone}</div>}
          {r.email && <div className="truncate">{r.email}</div>}
          {!r.phone && !r.email && '—'}
        </div>
      ),
    },
  ]

  const filters: FilterDef<SupplierRow>[] = [
    ...(categories.length
      ? [{
          key: 'category',
          label: 'Category',
          options: categories.map(c => ({ value: c, label: c })),
          predicate: (r: SupplierRow, v: string) => r.category === v,
        }]
      : []),
    {
      key: 'bbbee',
      label: 'B-BBEE',
      options: [
        { value: '1-4', label: 'Level 1–4' },
        { value: '5-8', label: 'Level 5–8' },
        { value: 'none', label: 'Not recorded' },
      ],
      predicate: (r, v) =>
        v === 'none' ? r.bbbbee_level === null
        : v === '1-4' ? r.bbbbee_level !== null && r.bbbbee_level <= 4
        : r.bbbbee_level !== null && r.bbbbee_level > 4,
    },
    {
      key: 'ownership',
      label: 'Ownership',
      options: [
        { value: 'women', label: 'Women-owned' },
        { value: 'youth', label: 'Youth-owned' },
        { value: 'community', label: 'Community-verified' },
      ],
      predicate: (r, v) =>
        v === 'women' ? r.women_owned
        : v === 'youth' ? r.youth_owned
        : r.is_community_verified,
    },
  ]

  if (!rows.length) {
    return (
      <EmptyState
        icon={Truck}
        title="No suppliers yet"
        body="Track who you buy from — with their B-BBEE level and ownership — so your preferential procurement spend is evidence, not a guess."
      />
    )
  }

  return (
    <DataTable
      rows={rows}
      columns={columns}
      filters={filters}
      getRowKey={r => r.id}
      searchPlaceholder="Search suppliers…"
      csvFilename="suppliers"
      initialSort={{ key: 'name', dir: 'asc' }}
    />
  )
}
