'use client'

import { Badge } from '@/components/ui/badge'
import { DataTable, type Column, type FilterDef } from '@/components/ui/DataTable'
import { formatZAR } from '@/lib/format'

export type ProductRow = {
  id:               string
  name:             string
  sku:              string | null
  category:         string | null
  unit:             string | null
  current_stock:    number
  reorder_level:    number
  cost_price:       number | null
  unit_price:       number | null
}

const money = (v: number | null) => formatZAR(v, { cents: true })
const isLow = (p: ProductRow) => Number(p.current_stock) <= Number(p.reorder_level)

export function InventoryTable({ rows }: { rows: ProductRow[] }) {
  const categories = Array.from(new Set(rows.map(r => r.category).filter(Boolean))) as string[]

  const columns: Column<ProductRow>[] = [
    {
      key: 'name',
      header: 'Name',
      render: p => <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{p.name}</span>,
    },
    {
      key: 'sku',
      header: 'SKU',
      accessor: p => p.sku ?? '',
      render: p => <span className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>{p.sku || '—'}</span>,
    },
    {
      key: 'category',
      header: 'Category',
      accessor: p => p.category ?? '',
      render: p => <Badge variant="gray">{p.category || 'Uncategorised'}</Badge>,
    },
    {
      key: 'current_stock',
      header: 'Qty',
      numeric: true,
      accessor: p => Number(p.current_stock),
      csv: p => Number(p.current_stock),
      render: p => (
        <span className="font-semibold" style={{ color: isLow(p) ? '#F87171' : 'var(--text-primary)' }}>
          {p.current_stock} {p.unit}
        </span>
      ),
    },
    {
      key: 'reorder_level',
      header: 'Reorder',
      numeric: true,
      accessor: p => Number(p.reorder_level),
      csv: p => Number(p.reorder_level),
      render: p => <span className="text-xs" style={{ color: 'var(--text-dim)' }}>{p.reorder_level}</span>,
    },
    {
      key: 'cost_price',
      header: 'Cost',
      numeric: true,
      accessor: p => Number(p.cost_price || 0),
      csv: p => Number(p.cost_price || 0),
      render: p => <span style={{ color: 'var(--text-muted)' }}>{money(p.cost_price)}</span>,
    },
    {
      key: 'unit_price',
      header: 'Selling',
      numeric: true,
      accessor: p => Number(p.unit_price || 0),
      csv: p => Number(p.unit_price || 0),
      render: p => <span style={{ color: '#34D399' }}>{money(p.unit_price)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      accessor: p => (isLow(p) ? 'low' : 'ok'),
      csv: p => (isLow(p) ? 'Low stock' : 'OK'),
      render: p => (isLow(p) ? <Badge variant="red">Low stock</Badge> : <Badge variant="green">OK</Badge>),
    },
  ]

  const filters: FilterDef<ProductRow>[] = [
    {
      key: 'status',
      label: 'Status',
      options: [
        { value: 'low', label: 'Low stock' },
        { value: 'ok', label: 'In stock' },
      ],
      predicate: (p, v) => (v === 'low' ? isLow(p) : !isLow(p)),
    },
    ...(categories.length
      ? [{
          key: 'category',
          label: 'Category',
          options: categories.map(c => ({ value: c, label: c })),
          predicate: (p: ProductRow, v: string) => p.category === v,
        }]
      : []),
  ]

  return (
    <DataTable<ProductRow>
      rows={rows}
      columns={columns}
      filters={filters}
      getRowKey={p => p.id}
      searchPlaceholder="Search name, SKU, category…"
      initialSort={{ key: 'current_stock', dir: 'asc' }}
      csvFilename="inventory.csv"
      pageSize={25}
      emptyState={
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          No inventory items found. Add products to start tracking stock.
        </p>
      }
      renderFooter={fr => {
        const cost = fr.reduce((s, p) => s + Number(p.current_stock) * Number(p.cost_price || 0), 0)
        const retail = fr.reduce((s, p) => s + Number(p.current_stock) * Number(p.unit_price || 0), 0)
        return (
          <>
            <td className="px-5 py-3 text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }} colSpan={5}>
              {fr.length} product{fr.length === 1 ? '' : 's'} · stock value
            </td>
            <td className="px-5 py-3 text-right tabular-nums" style={{ color: 'var(--text-primary)' }}>{money(cost)}</td>
            <td className="px-5 py-3 text-right tabular-nums" style={{ color: '#34D399' }}>{money(retail)}</td>
            <td className="px-5 py-3" />
          </>
        )
      }}
    />
  )
}
