'use client'

import { Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed, Mic, Bot, Users } from 'lucide-react'
import { DataTable, type Column, type FilterDef } from '@/components/ui/DataTable'
import { EmptyState } from '@/components/ui/EmptyState'

export type CallLog = {
  id:              string
  contact_id:      string | null
  twilio_call_sid: string | null
  direction:       string
  from_number:     string
  to_number:       string
  status:          string
  duration_sec:    number | null
  recording_url:   string | null
  transcript:      string | null
  sentiment:       string | null
  summary:         string | null
  ai_handled:      boolean
  transferred_to:  string | null
  started_at:      string
  ended_at:        string | null
}

function formatDuration(sec: number | null): string {
  if (!sec) return '—'
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  completed:     { label: 'Completed',   color: '#22C55E' },
  'in-progress': { label: 'Live',        color: '#6366F1' },
  transferred:   { label: 'Transferred', color: '#F59E0B' },
  'no-answer':   { label: 'No Answer',   color: '#94A3B8' },
  failed:        { label: 'Failed',      color: '#EF4444' },
  initiated:     { label: 'Initiated',   color: '#0EA5E9' },
}

const SENTIMENT_COLOR: Record<string, string> = {
  positive: '#34D399',
  neutral:  '#94A3B8',
  negative: '#F87171',
}

const titleCase = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)

export function RingCallTable({ rows }: { rows: CallLog[] }) {
  const columns: Column<CallLog>[] = [
    {
      key: 'started_at',
      header: 'Time',
      accessor: c => c.started_at,
      csv: c => new Date(c.started_at).toLocaleString('en-ZA'),
      render: c => (
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {new Date(c.started_at).toLocaleString('en-ZA', { dateStyle: 'short', timeStyle: 'short' })}
        </span>
      ),
    },
    {
      key: 'from_number',
      header: 'From',
      render: c => <span className="font-medium text-xs" style={{ color: 'var(--text-primary)' }}>{c.from_number}</span>,
    },
    {
      key: 'direction',
      header: 'Direction',
      accessor: c => c.direction,
      render: c => {
        const Icon = c.direction === 'inbound' ? PhoneIncoming : PhoneOutgoing
        return (
          <div className="flex items-center gap-1.5">
            <Icon className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
            <span className="text-xs capitalize" style={{ color: 'var(--text-secondary)' }}>{c.direction}</span>
          </div>
        )
      },
    },
    {
      key: 'status',
      header: 'Status',
      accessor: c => c.status,
      csv: c => (STATUS_CONFIG[c.status] ?? STATUS_CONFIG.completed).label,
      render: c => {
        const sc = STATUS_CONFIG[c.status] ?? STATUS_CONFIG.completed
        return (
          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
            style={{ background: `${sc.color}20`, color: sc.color }}>
            {sc.label}
          </span>
        )
      },
    },
    {
      key: 'duration_sec',
      header: 'Duration',
      numeric: true,
      align: 'left',
      accessor: c => Number(c.duration_sec || 0),
      csv: c => Number(c.duration_sec || 0),
      render: c => <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{formatDuration(c.duration_sec)}</span>,
    },
    {
      key: 'sentiment',
      header: 'Sentiment',
      accessor: c => c.sentiment ?? '',
      csv: c => (c.sentiment ? titleCase(c.sentiment) : ''),
      render: c =>
        c.sentiment ? (
          <span className="text-xs font-medium capitalize" style={{ color: SENTIMENT_COLOR[c.sentiment.toLowerCase()] ?? 'var(--text-secondary)' }}>
            {c.sentiment}
          </span>
        ) : (
          <span style={{ color: 'var(--text-dim)' }}>—</span>
        ),
    },
    {
      key: 'ai_handled',
      header: 'Handled by',
      accessor: c => (c.ai_handled ? 'AI' : 'Staff'),
      render: c => (
        <div className="flex items-center gap-1.5">
          {c.ai_handled ? (
            <><Bot className="w-3.5 h-3.5" style={{ color: 'var(--indigo-light)' }} /><span className="text-xs" style={{ color: 'var(--indigo-light)' }}>AI</span></>
          ) : (
            <><Users className="w-3.5 h-3.5" style={{ color: '#34D399' }} /><span className="text-xs" style={{ color: '#34D399' }}>Staff</span></>
          )}
        </div>
      ),
    },
    {
      key: 'summary',
      header: 'Transcript',
      sortable: false,
      accessor: c => c.summary ?? c.transcript ?? '',
      csv: c => (c.summary ?? c.transcript ?? '').replace(/\n/g, ' '),
      render: c => (
        <div className="max-w-xs">
          {c.summary ? (
            <p className="text-xs line-clamp-2" style={{ color: 'var(--text-secondary)' }}>{c.summary}</p>
          ) : c.transcript ? (
            <p className="text-xs line-clamp-2" style={{ color: 'var(--text-dim)' }}>{c.transcript.split('\n')[0]}</p>
          ) : (
            <span style={{ color: 'var(--text-dim)' }}>—</span>
          )}
          {c.recording_url && (
            <a href={c.recording_url} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-1 text-xs" style={{ color: 'var(--indigo-light)' }}>
              <Mic className="w-3 h-3" /> Recording
            </a>
          )}
        </div>
      ),
    },
  ]

  const filters: FilterDef<CallLog>[] = [
    {
      key: 'direction',
      label: 'Direction',
      options: [
        { value: 'inbound', label: 'Inbound' },
        { value: 'outbound', label: 'Outbound' },
      ],
      predicate: (c, v) => c.direction === v,
    },
    {
      key: 'status',
      label: 'Status',
      options: Object.entries(STATUS_CONFIG).map(([value, { label }]) => ({ value, label })),
      predicate: (c, v) => c.status === v,
    },
    {
      key: 'handled',
      label: 'Handled by',
      options: [
        { value: 'ai', label: 'AI' },
        { value: 'staff', label: 'Staff' },
      ],
      predicate: (c, v) => (v === 'ai' ? c.ai_handled : !c.ai_handled),
    },
  ]

  return (
    <DataTable<CallLog>
      rows={rows}
      columns={columns}
      filters={filters}
      getRowKey={c => c.id}
      searchPlaceholder="Search number, summary, transcript…"
      searchExtra={c => [c.to_number, c.transcript].filter(Boolean).join(' ')}
      initialSort={{ key: 'started_at', dir: 'desc' }}
      csvFilename="call-log.csv"
      pageSize={25}
      emptyState={
        <EmptyState
          icon={Phone}
          title="No calls yet"
          body="Once your Twilio number is connected, the AI voice agent answers calls and logs every one here."
          action={{ label: 'Set up your number', href: '/dashboard/settings' }}
          compact
        />
      }
    />
  )
}
