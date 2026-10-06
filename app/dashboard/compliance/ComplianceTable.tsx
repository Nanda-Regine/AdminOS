'use client'

import { useState } from 'react'
import { daysUntil } from '@/lib/time/sast'
import { useRouter } from 'next/navigation'
import { ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { DataTable, type Column, type FilterDef } from '@/components/ui/DataTable'
import { EmptyState } from '@/components/ui/EmptyState'

export type ComplianceRow = {
  id:                  string
  item_type:           string
  title:               string
  description:         string | null
  due_date:            string | null
  recurrence:          string | null
  status:              string
  penalty_description: string | null
  completed_at:        string | null
}

// One place that maps a compliance status to its label and colour. Ported from
// BB MotherShip Deluxe's STATUS_CONFIG idea: keying on the union rather than
// `string` means adding a status breaks the build instead of silently
// falling through to grey.
type Status = 'upcoming' | 'due' | 'overdue' | 'completed' | 'not_applicable'

const STATUS: Record<Status, { label: string; tone: 'green' | 'yellow' | 'red' | 'gray' | 'blue' }> = {
  overdue:        { label: 'Overdue',        tone: 'red' },
  due:            { label: 'Due soon',       tone: 'yellow' },
  upcoming:       { label: 'Upcoming',       tone: 'blue' },
  completed:      { label: 'Completed',      tone: 'green' },
  not_applicable: { label: 'Not applicable', tone: 'gray' },
}
const statusOf = (s: string) => STATUS[(s as Status)] ?? STATUS.upcoming

// Due dates are SAST calendar dates. Both helpers work on the date itself,
// never the runtime's local midnight: the server is UTC and the browser SAST,
// so between 00:00 and 02:00 SAST the old countdown was a day out and the
// page failed hydration (React #418).
const fmtDate = (d: string | null) =>
  d ? new Date(d + 'T12:00:00Z').toLocaleDateString('en-ZA', { timeZone: 'Africa/Johannesburg', day: '2-digit', month: 'short', year: 'numeric' }) : '—'

const daysAway = (d: string | null): number | null => (d ? daysUntil(d) : null)

export function ComplianceTable({ rows }: { rows: ComplianceRow[] }) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function setStatus(id: string, status: Status) {
    setBusy(id)
    setError(null)
    try {
      const res = await fetch('/api/compliance', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      })
      if (!res.ok) throw new Error(await res.text())
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update that item')
    } finally {
      setBusy(null)
    }
  }

  const columns: Column<ComplianceRow>[] = [
    {
      key: 'title',
      header: 'Obligation',
      render: r => (
        <div className="min-w-0">
          <div className="font-medium truncate" style={{ color: 'var(--text-primary)' }}>{r.title}</div>
          {r.description && (
            <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{r.description}</div>
          )}
        </div>
      ),
      accessor: r => r.title,
    },
    {
      key: 'due_date',
      header: 'Due',
      accessor: r => r.due_date ?? '',
      csv: r => r.due_date ?? '',
      render: r => {
        const n = daysAway(r.due_date)
        const terminal = r.status === 'completed' || r.status === 'not_applicable'
        return (
          <div className="whitespace-nowrap">
            <div style={{ color: 'var(--text-primary)' }}>{fmtDate(r.due_date)}</div>
            {n !== null && !terminal && (
              <div className="text-xs" style={{ color: n < 0 ? 'var(--chip-red-fg)' : 'var(--text-muted)' }}>
                {n < 0 ? `${Math.abs(n)} days late` : n === 0 ? 'today' : `in ${n} days`}
              </div>
            )}
          </div>
        )
      },
    },
    {
      key: 'status',
      header: 'Status',
      accessor: r => statusOf(r.status).label,
      render: r => {
        const s = statusOf(r.status)
        return <Badge variant={s.tone}>{s.label}</Badge>
      },
    },
    {
      key: 'recurrence',
      header: 'Repeats',
      accessor: r => r.recurrence ?? '',
      render: r => (
        <span className="text-xs capitalize" style={{ color: 'var(--text-muted)' }}>
          {r.recurrence ?? 'once'}
        </span>
      ),
    },
    {
      key: 'penalty_description',
      header: 'If you miss it',
      accessor: r => r.penalty_description ?? '',
      render: r => (
        <span className="text-xs" style={{ color: 'var(--chip-amber-fg)' }}>
          {r.penalty_description ?? '—'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: r =>
        r.status === 'completed' ? (
          <button
            onClick={() => setStatus(r.id, 'upcoming')}
            disabled={busy === r.id}
            className="text-xs underline disabled:opacity-50 min-h-[36px] px-1"
            style={{ color: 'var(--text-muted)' }}
          >
            Reopen
          </button>
        ) : (
          <button
            onClick={() => setStatus(r.id, 'completed')}
            disabled={busy === r.id}
            className="text-xs font-semibold rounded-lg px-3 min-h-[36px] disabled:opacity-50"
            style={{ background: 'var(--chip-green-bg)', color: 'var(--chip-green-fg)' }}
          >
            {busy === r.id ? '…' : 'Mark done'}
          </button>
        ),
    },
  ]

  const filters: FilterDef<ComplianceRow>[] = [
    {
      key: 'status',
      label: 'Status',
      options: (Object.keys(STATUS) as Status[]).map(k => ({ value: k, label: STATUS[k].label })),
      predicate: (r, v) => r.status === v,
    },
    {
      key: 'recurrence',
      label: 'Repeats',
      options: [
        { value: 'monthly', label: 'Monthly' },
        { value: 'quarterly', label: 'Quarterly' },
        { value: 'bi-annual', label: 'Bi-annual' },
        { value: 'annual', label: 'Annual' },
      ],
      predicate: (r, v) => r.recurrence === v,
    },
  ]

  if (!rows.length) {
    return (
      <EmptyState
        icon={ShieldCheck}
        title="No compliance items yet"
        body="Your SA statutory calendar seeds automatically when your business is set up."
      />
    )
  }

  return (
    <>
      {error && (
        <div className="rounded-xl px-4 py-3 text-sm mb-3"
             style={{ background: 'var(--chip-red-bg)', color: 'var(--chip-red-fg)' }}>
          {error}
        </div>
      )}
      <DataTable
        rows={rows}
        columns={columns}
        filters={filters}
        getRowKey={r => r.id}
        searchPlaceholder="Search obligations…"
        csvFilename="compliance-calendar"
        initialSort={{ key: 'due_date', dir: 'asc' }}
      />
    </>
  )
}
