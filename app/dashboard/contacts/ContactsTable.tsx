'use client'

import { useRouter } from 'next/navigation'
import { ChevronRight, Users } from 'lucide-react'
import { DataTable, type Column, type FilterDef } from '@/components/ui/DataTable'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatZAR } from '@/lib/format'

export type ContactRow = {
  id:                string
  full_name:         string | null
  phone:             string | null
  email:             string | null
  company:           string | null
  contact_type:      string | null
  balance_owed:      number
  total_invoiced:    number
  total_paid:        number
  sentiment_score:   number | null
  last_contacted_at: string | null
  tags:              string[]
  source:            string | null
  wa_id:             string | null
  created_at:        string
}

function initials(name: string | null, phone: string | null): string {
  if (name) {
    const parts = name.trim().split(' ')
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : name.slice(0, 2).toUpperCase()
  }
  return (phone ?? '??').slice(-2)
}

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  client:   { bg: 'rgba(99,102,241,0.15)',  text: '#818CF8' },
  supplier: { bg: 'rgba(245,158,11,0.15)',  text: '#F59E0B' },
  staff:    { bg: 'rgba(34,197,94,0.15)',   text: '#22C55E' },
  unknown:  { bg: 'rgba(148,163,184,0.12)', text: '#94A3B8' },
}

const SENTIMENT_LABEL: Record<number, { label: string; color: string }> = {
  5: { label: 'Excellent', color: '#22C55E' },
  4: { label: 'Positive',  color: '#4ADE80' },
  3: { label: 'Neutral',   color: '#94A3B8' },
  2: { label: 'Negative',  color: '#F97316' },
  1: { label: 'Urgent',    color: '#EF4444' },
}

function sentimentInfo(score: number | null) {
  if (!score) return null
  const clamped = Math.max(1, Math.min(5, Math.round(score)))
  return SENTIMENT_LABEL[clamped] ?? null
}

const AVATAR_COLORS = ['#6366F1', '#8B5CF6', '#EC4899', '#0EA5E9', '#10B981', '#F59E0B', '#EF4444', '#14B8A6']
function avatarColor(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

export function ContactsTable({ rows }: { rows: ContactRow[] }) {
  const router = useRouter()

  const columns: Column<ContactRow>[] = [
    {
      key: 'full_name',
      header: 'Contact',
      accessor: c => c.full_name || c.phone || '(unnamed)',
      render: c => {
        const color = avatarColor(c.id)
        return (
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
              style={{ background: color }}
            >
              {initials(c.full_name, c.phone)}
            </div>
            <div>
              <p className="font-medium" style={{ color: 'var(--text-primary)' }}>
                {c.full_name || c.phone || '(unnamed)'}
              </p>
              {c.phone && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{c.phone}</p>}
              {c.company && <p className="text-xs" style={{ color: 'var(--text-dim)' }}>{c.company}</p>}
            </div>
          </div>
        )
      },
    },
    {
      key: 'contact_type',
      header: 'Type',
      accessor: c => c.contact_type ?? 'unknown',
      render: c => {
        const tcolor = TYPE_COLORS[c.contact_type ?? 'unknown'] ?? TYPE_COLORS.unknown
        return (
          <span
            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
            style={{ background: tcolor.bg, color: tcolor.text }}
          >
            {c.contact_type ?? 'unknown'}
          </span>
        )
      },
    },
    {
      key: 'sentiment_score',
      header: 'Sentiment',
      numeric: true,
      align: 'left',
      accessor: c => c.sentiment_score ?? null,
      csv: c => sentimentInfo(c.sentiment_score)?.label ?? '',
      render: c => {
        const sinfo = sentimentInfo(c.sentiment_score)
        return sinfo ? (
          <span className="text-xs font-medium" style={{ color: sinfo.color }}>
            {sinfo.label}
          </span>
        ) : (
          <span style={{ color: 'var(--text-dim)' }}>—</span>
        )
      },
    },
    {
      key: 'balance_owed',
      header: 'Balance Owed',
      numeric: true,
      accessor: c => Number(c.balance_owed || 0),
      csv: c => Number(c.balance_owed || 0),
      render: c =>
        c.balance_owed > 0 ? (
          <span className="font-semibold text-red-400">{formatZAR(c.balance_owed)}</span>
        ) : (
          <span className="text-xs" style={{ color: '#22C55E' }}>Clear</span>
        ),
    },
    {
      key: 'total_paid',
      header: 'Revenue',
      numeric: true,
      accessor: c => Number(c.total_paid || 0),
      csv: c => Number(c.total_paid || 0),
      render: c => <span style={{ color: 'var(--text-secondary)' }}>{formatZAR(c.total_paid)}</span>,
    },
    {
      key: 'last_contacted_at',
      header: 'Last Contacted',
      accessor: c => c.last_contacted_at ?? '',
      csv: c => (c.last_contacted_at ? new Date(c.last_contacted_at).toLocaleDateString('en-ZA') : ''),
      render: c => (
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {c.last_contacted_at ? new Date(c.last_contacted_at).toLocaleDateString('en-ZA') : '—'}
        </span>
      ),
    },
    {
      key: '_view',
      header: '',
      sortable: false,
      render: () => (
        <span className="inline-flex items-center gap-1 text-xs font-medium" style={{ color: 'var(--indigo-light)' }}>
          View <ChevronRight className="w-3 h-3" />
        </span>
      ),
    },
  ]

  const filters: FilterDef<ContactRow>[] = [
    {
      key: 'contact_type',
      label: 'Type',
      options: [
        { value: 'client', label: 'Client' },
        { value: 'supplier', label: 'Supplier' },
        { value: 'staff', label: 'Staff' },
        { value: 'unknown', label: 'Unknown' },
      ],
      predicate: (c, v) => (c.contact_type ?? 'unknown') === v,
    },
    {
      key: 'debt',
      label: 'Balance',
      options: [
        { value: 'owing', label: 'Owing' },
        { value: 'clear', label: 'Clear' },
      ],
      predicate: (c, v) => (v === 'owing' ? c.balance_owed > 0 : c.balance_owed <= 0),
    },
  ]

  return (
    <DataTable<ContactRow>
      rows={rows}
      columns={columns}
      filters={filters}
      getRowKey={c => c.id}
      searchPlaceholder="Search name, phone, email…"
      searchExtra={c => [c.email, c.company, c.wa_id].filter(Boolean).join(' ')}
      rowHref={c => `/dashboard/contacts/${c.id}`}
      initialSort={{ key: 'balance_owed', dir: 'desc' }}
      csvFilename="contacts.csv"
      pageSize={25}
      emptyState={
        <EmptyState
          icon={Users}
          title="No contacts yet"
          body="Contacts are created automatically when someone messages you — or add your first one now."
          action={{ label: 'Add a contact', href: '?new=1' }}
          compact
        />
      }
    />
  )
}
