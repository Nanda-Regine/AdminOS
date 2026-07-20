'use client'

import { Users, Zap } from 'lucide-react'
import { DataTable, type Column, type FilterDef } from '@/components/ui/DataTable'
import { EmptyState } from '@/components/ui/EmptyState'
import { SequenceToggle } from '@/components/sequences/SequenceToggle'

export type Step = { id: string; name: string; delay_hours: number; message: string }

export type Sequence = {
  id:                 string
  name:               string
  trigger_type:       string
  steps:              Step[]
  is_active:          boolean
  created_at:         string
  active_enrollments: number
}

const TRIGGER_LABELS: Record<string, string> = {
  new_contact:     'New Contact',
  overdue_invoice: 'Overdue Invoice',
  manual:          'Manual',
  keyword:         'Keyword',
  new_client:      'New Client',
  onboarding:      'Onboarding',
}

const triggerLabel = (t: string) => TRIGGER_LABELS[t] ?? t

export function SequencesTable({ rows }: { rows: Sequence[] }) {
  const triggers = Array.from(new Set(rows.map(r => r.trigger_type)))

  const columns: Column<Sequence>[] = [
    {
      key: 'name',
      header: 'Sequence',
      render: s => (
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full shrink-0" style={{ background: s.is_active ? '#22C55E' : '#475569' }} />
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{s.name}</p>
            {s.steps.length > 0 && (
              <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
                {s.steps.map(st => `${st.delay_hours}h`).join(' → ')}
              </p>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'trigger_type',
      header: 'Trigger',
      accessor: s => triggerLabel(s.trigger_type),
      render: s => (
        <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--indigo-muted)', color: 'var(--indigo-light)' }}>
          {triggerLabel(s.trigger_type)}
        </span>
      ),
    },
    {
      key: 'steps',
      header: 'Steps',
      numeric: true,
      align: 'left',
      accessor: s => s.steps.length,
      csv: s => s.steps.length,
      render: s => <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{s.steps.length}</span>,
    },
    {
      key: 'active_enrollments',
      header: 'Enrolled',
      numeric: true,
      align: 'left',
      accessor: s => s.active_enrollments,
      csv: s => s.active_enrollments,
      render: s =>
        s.active_enrollments > 0 ? (
          <span className="inline-flex items-center gap-1 text-xs" style={{ color: '#38BDF8' }}>
            <Users className="w-3.5 h-3.5" /> {s.active_enrollments}
          </span>
        ) : (
          <span style={{ color: 'var(--text-dim)' }}>—</span>
        ),
    },
    {
      key: 'is_active',
      header: 'Active',
      accessor: s => (s.is_active ? 1 : 0),
      csv: s => (s.is_active ? 'active' : 'paused'),
      render: s => <SequenceToggle sequenceId={s.id} isActive={s.is_active} />,
    },
  ]

  const filters: FilterDef<Sequence>[] = [
    {
      key: 'active',
      label: 'Status',
      options: [
        { value: 'active', label: 'Active' },
        { value: 'paused', label: 'Paused' },
      ],
      predicate: (s, v) => (v === 'active' ? s.is_active : !s.is_active),
    },
    ...(triggers.length
      ? [{
          key: 'trigger_type',
          label: 'Trigger',
          options: triggers.map(t => ({ value: t, label: triggerLabel(t) })),
          predicate: (s: Sequence, v: string) => s.trigger_type === v,
        }]
      : []),
  ]

  return (
    <DataTable<Sequence>
      rows={rows}
      columns={columns}
      filters={filters}
      getRowKey={s => s.id}
      searchPlaceholder="Search sequences…"
      initialSort={{ key: 'name', dir: 'asc' }}
      csvFilename="sequences.csv"
      pageSize={25}
      emptyState={
        <EmptyState
          icon={Zap}
          title="No sequences yet"
          body="Build automated multi-step WhatsApp flows that trigger on contact events. Create your first sequence to start."
          action={{ label: 'New sequence', href: '/dashboard/sequences/new' }}
          compact
        />
      }
    />
  )
}
