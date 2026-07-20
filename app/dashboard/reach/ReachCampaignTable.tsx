'use client'

import { Radio, Users, CheckCheck, AlertCircle, Loader2, FileText, Clock, Plus } from 'lucide-react'
import Link from 'next/link'
import { DataTable, type Column, type FilterDef } from '@/components/ui/DataTable'
import { EmptyState } from '@/components/ui/EmptyState'
import { SendCampaignButton } from '@/components/reach/SendCampaignButton'

export type Campaign = {
  id:               string
  name:             string
  status:           string
  channel:          string
  message_body:     string | null
  audience_filter:  Record<string, unknown>
  scheduled_at:     string | null
  sent_at:          string | null
  total_recipients: number
  sent_count:       number
  delivered_count:  number
  read_count:       number
  failed_count:     number
  created_at:       string
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  draft:     { label: 'Draft',     color: '#94A3B8', icon: FileText },
  sending:   { label: 'Sending',   color: '#6366F1', icon: Loader2 },
  sent:      { label: 'Sent',      color: '#22C55E', icon: CheckCheck },
  failed:    { label: 'Failed',    color: '#EF4444', icon: AlertCircle },
  scheduled: { label: 'Scheduled', color: '#F59E0B', icon: Clock },
}

function pct(num: number, denom: number) {
  if (!denom) return '—'
  return `${Math.round((num / denom) * 100)}%`
}

function audienceOf(c: Campaign): string {
  const filter = c.audience_filter as { contact_type?: string[] }
  return filter?.contact_type?.length ? filter.contact_type.join(', ') : 'All contacts'
}

export function ReachCampaignTable({ rows }: { rows: Campaign[] }) {
  const columns: Column<Campaign>[] = [
    {
      key: 'name',
      header: 'Campaign',
      accessor: c => c.name,
      render: c => (
        <div>
          <p className="font-medium text-xs" style={{ color: 'var(--text-primary)' }}>{c.name}</p>
          {c.message_body && (
            <p className="text-xs line-clamp-1 mt-0.5" style={{ color: 'var(--text-dim)' }}>{c.message_body}</p>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      accessor: c => c.status,
      csv: c => (STATUS_CONFIG[c.status] ?? STATUS_CONFIG.draft).label,
      render: c => {
        const sc = STATUS_CONFIG[c.status] ?? STATUS_CONFIG.draft
        const Icon = sc.icon
        return (
          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
            style={{ background: `${sc.color}20`, color: sc.color }}>
            <Icon className="w-3 h-3" />
            {sc.label}
          </span>
        )
      },
    },
    {
      key: 'audience',
      header: 'Audience',
      sortable: false,
      accessor: c => audienceOf(c),
      csv: c => audienceOf(c),
      render: c => (
        <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
          <Users className="w-3 h-3" />
          <span className="capitalize">{audienceOf(c)}</span>
        </div>
      ),
    },
    {
      key: 'sent_count',
      header: 'Sent',
      numeric: true,
      align: 'left',
      accessor: c => Number(c.sent_count || 0),
      csv: c => Number(c.sent_count || 0),
      render: c => (
        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          {c.sent_count > 0 ? c.sent_count.toLocaleString() : '—'}
        </span>
      ),
    },
    {
      key: 'delivered_count',
      header: 'Delivered',
      numeric: true,
      align: 'left',
      accessor: c => Number(c.delivered_count || 0),
      csv: c => pct(c.delivered_count, c.sent_count),
      render: c => <span className="text-xs" style={{ color: '#38BDF8' }}>{pct(c.delivered_count, c.sent_count)}</span>,
    },
    {
      key: 'read_count',
      header: 'Read',
      numeric: true,
      align: 'left',
      accessor: c => Number(c.read_count || 0),
      csv: c => pct(c.read_count, c.sent_count),
      render: c => <span className="text-xs" style={{ color: '#F59E0B' }}>{pct(c.read_count, c.sent_count)}</span>,
    },
    {
      key: 'failed_count',
      header: 'Failed',
      numeric: true,
      align: 'left',
      accessor: c => Number(c.failed_count || 0),
      csv: c => Number(c.failed_count || 0),
      render: c => (
        <span className="text-xs" style={{ color: c.failed_count > 0 ? '#F87171' : 'var(--text-dim)' }}>
          {c.failed_count > 0 ? c.failed_count : '—'}
        </span>
      ),
    },
    {
      key: 'created_at',
      header: 'Date',
      accessor: c => c.created_at,
      csv: c => new Date(c.created_at).toLocaleString('en-ZA'),
      render: c => (
        <span className="text-xs" style={{ color: 'var(--text-dim)' }}>
          {new Date(c.created_at).toLocaleString('en-ZA', { dateStyle: 'short', timeStyle: 'short' })}
        </span>
      ),
    },
    {
      key: '_action',
      header: '',
      sortable: false,
      render: c => (c.status === 'draft' ? <SendCampaignButton campaignId={c.id} /> : null),
    },
  ]

  const filters: FilterDef<Campaign>[] = [
    {
      key: 'status',
      label: 'Status',
      options: Object.entries(STATUS_CONFIG).map(([value, { label }]) => ({ value, label })),
      predicate: (c, v) => c.status === v,
    },
  ]

  return (
    <DataTable<Campaign>
      rows={rows}
      columns={columns}
      filters={filters}
      getRowKey={c => c.id}
      searchPlaceholder="Search name, message…"
      searchExtra={c => c.message_body ?? ''}
      initialSort={{ key: 'created_at', dir: 'desc' }}
      csvFilename="campaigns.csv"
      pageSize={25}
      toolbarExtra={
        <Link href="/dashboard/reach/new"
          className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
          style={{ background: 'var(--indigo)', color: '#fff' }}>
          <Plus className="w-3.5 h-3.5" />
          New Campaign
        </Link>
      }
      emptyState={
        <EmptyState
          icon={Radio}
          title="No campaigns yet"
          body="Broadcast a WhatsApp or SMS message to your whole audience at once. Create your first campaign to reach them."
          action={{ label: 'Create campaign', href: '/dashboard/reach/new' }}
          compact
        />
      }
    />
  )
}
