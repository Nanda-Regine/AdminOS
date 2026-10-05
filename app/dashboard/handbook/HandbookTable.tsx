'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, ClipboardList } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { DataTable, type Column, type FilterDef } from '@/components/ui/DataTable'
import { EmptyState } from '@/components/ui/EmptyState'

export type SopRow = {
  id:                       string
  title:                    string
  category:                 string | null
  content:                  unknown
  version:                  number
  status:                   string
  requires_acknowledgement: boolean
  ack_count:                number
  acked_by_me:              boolean
  created_at:               string
}

function categoryVariant(category: string | null): 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'gray' {
  const map: Record<string, 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'gray'> = {
    hr: 'blue', operations: 'green', finance: 'yellow', safety: 'red', compliance: 'purple',
  }
  return map[(category ?? '').toLowerCase()] ?? 'gray'
}

const statusVariant: Record<string, 'green' | 'yellow' | 'gray'> = {
  active: 'green', draft: 'yellow', archived: 'gray',
}

/** SOP content is stored as jsonb — the create modal writes `{ text }`. */
function contentText(content: unknown): string {
  if (typeof content === 'string') return content
  if (content && typeof content === 'object' && 'text' in content && typeof (content as { text: unknown }).text === 'string') {
    return (content as { text: string }).text
  }
  return content ? JSON.stringify(content, null, 2) : ''
}

export function HandbookTable({ rows, totalStaff, editor }: { rows: SopRow[]; totalStaff: number; editor: boolean }) {
  const [selected, setSelected] = useState<SopRow | null>(null)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const router = useRouter()

  // SOPs are created as drafts, and there was no way to publish one — so no
  // policy ever reached staff — and no way to acknowledge one on the web.
  async function act(sop: SopRow, init: RequestInit) {
    setBusy(true); setActionError(null)
    try {
      const res = await fetch(`/api/sops/${sop.id}`, { headers: { 'Content-Type': 'application/json' }, ...init })
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || `Failed (${res.status})`)
      setSelected(null)
      router.refresh()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }
  const setStatus = (sop: SopRow, status: 'active' | 'draft' | 'archived') =>
    act(sop, { method: 'PATCH', body: JSON.stringify({ status }) })
  const acknowledge = (sop: SopRow) => act(sop, { method: 'POST' })
  const btn = 'text-sm font-semibold px-4 py-2 rounded-xl transition-opacity disabled:opacity-50'

  const categories = Array.from(new Set(rows.map(r => r.category).filter(Boolean))) as string[]

  const columns: Column<SopRow>[] = [
    {
      key: 'title',
      header: 'Title',
      render: s => (
        <div className="flex items-center gap-2">
          <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{s.title}</span>
          {s.requires_acknowledgement && <Badge variant="yellow">Ack required</Badge>}
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      accessor: s => s.category ?? 'General',
      render: s => <Badge variant={categoryVariant(s.category)}>{s.category || 'General'}</Badge>,
    },
    {
      key: 'status',
      header: 'Status',
      accessor: s => s.status,
      render: s => <Badge variant={statusVariant[s.status] || 'gray'}>{s.status}</Badge>,
    },
    {
      key: 'version',
      header: 'Version',
      numeric: true,
      align: 'left',
      accessor: s => s.version,
      render: s => <span className="text-xs" style={{ color: 'var(--text-muted)' }}>v{s.version}</span>,
    },
    {
      key: 'ack_count',
      header: 'Acknowledged',
      numeric: true,
      align: 'left',
      accessor: s => s.ack_count,
      csv: s => (s.requires_acknowledgement ? `${s.ack_count}/${totalStaff}` : ''),
      render: s =>
        s.requires_acknowledgement && totalStaff > 0 ? (
          <span className="text-sm font-semibold" style={{ color: s.ack_count >= totalStaff ? '#34D399' : '#FB923C' }}>
            {s.ack_count} / {totalStaff}
          </span>
        ) : (
          <span style={{ color: 'var(--text-dim)' }}>—</span>
        ),
    },
    {
      key: '_view',
      header: '',
      sortable: false,
      render: s => (
        <button
          onClick={() => setSelected(s)}
          className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md transition-colors hover:bg-[var(--surface-hover)]"
          style={{ color: 'var(--indigo-light)' }}
        >
          <Eye className="w-3.5 h-3.5" /> View
        </button>
      ),
    },
  ]

  const filters: FilterDef<SopRow>[] = [
    {
      key: 'status',
      label: 'Status',
      options: [
        { value: 'active', label: 'Active' },
        { value: 'draft', label: 'Draft' },
        { value: 'archived', label: 'Archived' },
      ],
      predicate: (s, v) => s.status === v,
    },
    ...(categories.length
      ? [{
          key: 'category',
          label: 'Category',
          options: categories.map(c => ({ value: c, label: c })),
          predicate: (s: SopRow, v: string) => s.category === v,
        }]
      : []),
  ]

  return (
    <>
      <DataTable<SopRow>
        rows={rows}
        columns={columns}
        filters={filters}
        getRowKey={s => s.id}
        onRowClick={s => setSelected(s)}
        searchPlaceholder="Search procedures…"
        initialSort={{ key: 'title', dir: 'asc' }}
        csvFilename="sops.csv"
        pageSize={25}
        emptyState={
          <EmptyState
            icon={ClipboardList}
            title="No SOPs yet"
            body="Document how your business runs so anyone can follow the same steps. Add your first procedure to build the handbook."
            action={{ label: 'New SOP', href: '?new=1' }}
            compact
          />
        }
      />

      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected?.title ?? 'SOP'} size="lg">
        {selected && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={categoryVariant(selected.category)}>{selected.category || 'General'}</Badge>
              <Badge variant={statusVariant[selected.status] || 'gray'}>{selected.status}</Badge>
              <span className="text-xs" style={{ color: 'var(--text-dim)' }}>Version {selected.version}</span>
              {selected.requires_acknowledgement && <Badge variant="yellow">Ack required</Badge>}
            </div>
            <div
              className="text-sm whitespace-pre-wrap leading-relaxed rounded-xl p-4"
              style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}
            >
              {contentText(selected.content) || (
                <span style={{ color: 'var(--text-dim)' }}>This procedure has no written content yet.</span>
              )}
            </div>
            {actionError && <p className="text-sm" style={{ color: '#F87171' }}>{actionError}</p>}
            <div className="flex flex-wrap gap-2 justify-end">
              {selected.status === 'active' && selected.requires_acknowledgement && (
                selected.acked_by_me
                  ? <span className="text-sm self-center" style={{ color: '#34D399' }}>You acknowledged this version</span>
                  : <button type="button" disabled={busy} onClick={() => acknowledge(selected)} className={btn} style={{ background: 'var(--indigo)', color: '#fff' }}>I&apos;ve read and understood this</button>
              )}
              {editor && selected.status !== 'active' && (
                <button type="button" disabled={busy} onClick={() => setStatus(selected, 'active')} className={btn} style={{ background: '#059669', color: '#fff' }}>Publish to team</button>
              )}
              {editor && selected.status === 'active' && (
                <button type="button" disabled={busy} onClick={() => setStatus(selected, 'draft')} className={btn} style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>Unpublish</button>
              )}
              {editor && selected.status !== 'archived' && (
                <button type="button" disabled={busy} onClick={() => setStatus(selected, 'archived')} className={btn} style={{ background: 'rgba(239,68,68,0.12)', color: '#F87171' }}>Archive</button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}
