'use client'

import { useState } from 'react'
import { Eye, BookOpen } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { DataTable, type Column, type FilterDef } from '@/components/ui/DataTable'
import { EmptyState } from '@/components/ui/EmptyState'

// kb_articles has no slug/body/category columns — body is `content`, category
// comes from the kb_categories FK (resolved to a name string in the page).
export type KbArticle = {
  id:         string
  title:      string
  content:    string
  category:   string
  published:  boolean
  view_count: number
  created_at: string
}

function categoryVariant(cat: string): 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'gray' {
  const map: Record<string, 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'gray'> = {
    policy: 'blue', hr: 'purple', finance: 'green', operations: 'yellow', compliance: 'red', product: 'blue',
  }
  return map[(cat || '').toLowerCase()] ?? 'gray'
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-ZA', { year: 'numeric', month: 'short', day: 'numeric' })
}

export function KnowledgeBaseTable({ rows }: { rows: KbArticle[] }) {
  const [selected, setSelected] = useState<KbArticle | null>(null)

  const categories = Array.from(new Set(rows.map(r => r.category).filter(Boolean)))

  const columns: Column<KbArticle>[] = [
    {
      key: 'title',
      header: 'Title',
      render: a => <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{a.title}</span>,
    },
    {
      key: 'category',
      header: 'Category',
      accessor: a => a.category,
      render: a => <Badge variant={categoryVariant(a.category)}>{a.category}</Badge>,
    },
    {
      key: 'published',
      header: 'Status',
      accessor: a => (a.published ? 1 : 0),
      csv: a => (a.published ? 'Published' : 'Draft'),
      render: a => <Badge variant={a.published ? 'green' : 'gray'}>{a.published ? 'Published' : 'Draft'}</Badge>,
    },
    {
      key: 'view_count',
      header: 'Views',
      numeric: true,
      accessor: a => Number(a.view_count || 0),
      csv: a => Number(a.view_count || 0),
      render: a => <span className="text-xs tabular-nums" style={{ color: 'var(--text-secondary)' }}>{(a.view_count || 0).toLocaleString()}</span>,
    },
    {
      key: 'created_at',
      header: 'Created',
      accessor: a => a.created_at,
      csv: a => formatDate(a.created_at),
      render: a => <span className="text-xs" style={{ color: 'var(--text-dim)' }}>{formatDate(a.created_at)}</span>,
    },
    {
      key: '_view',
      header: '',
      sortable: false,
      render: a => (
        <button
          onClick={e => { e.stopPropagation(); setSelected(a) }}
          className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md transition-colors hover:bg-[var(--surface-hover)]"
          style={{ color: 'var(--indigo-light)' }}
        >
          <Eye className="w-3.5 h-3.5" /> Read
        </button>
      ),
    },
  ]

  const filters: FilterDef<KbArticle>[] = [
    {
      key: 'published',
      label: 'Status',
      options: [
        { value: 'published', label: 'Published' },
        { value: 'draft', label: 'Draft' },
      ],
      predicate: (a, v) => (v === 'published' ? a.published : !a.published),
    },
    ...(categories.length
      ? [{
          key: 'category',
          label: 'Category',
          options: categories.map(c => ({ value: c, label: c })),
          predicate: (a: KbArticle, v: string) => a.category === v,
        }]
      : []),
  ]

  return (
    <>
      <DataTable<KbArticle>
        rows={rows}
        columns={columns}
        filters={filters}
        getRowKey={a => a.id}
        onRowClick={a => setSelected(a)}
        searchPlaceholder="Search articles…"
        searchExtra={a => a.content ?? ''}
        initialSort={{ key: 'created_at', dir: 'desc' }}
        csvFilename="knowledge-base.csv"
        pageSize={25}
        emptyState={
          <EmptyState
            icon={BookOpen}
            title="No articles yet"
            body="Write help articles so customers and staff can find answers on their own. Create your first article to get started."
            action={{ label: 'New article', href: '?new=1' }}
            compact
          />
        }
      />

      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected?.title ?? 'Article'} size="lg">
        {selected && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={categoryVariant(selected.category)}>{selected.category}</Badge>
              <Badge variant={selected.published ? 'green' : 'gray'}>{selected.published ? 'Published' : 'Draft'}</Badge>
              <span className="text-xs" style={{ color: 'var(--text-dim)' }}>{formatDate(selected.created_at)}</span>
            </div>
            <div
              className="text-sm whitespace-pre-wrap leading-relaxed rounded-xl p-4"
              style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}
            >
              {selected.content || <span style={{ color: 'var(--text-dim)' }}>This article has no content yet.</span>}
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}
