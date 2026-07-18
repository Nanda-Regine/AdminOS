'use client'

import { useState } from 'react'
import { Eye, ExternalLink } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { DataTable, type Column, type FilterDef } from '@/components/ui/DataTable'

export type KbArticle = {
  id:         string
  title:      string
  slug:       string
  body:       string
  category:   string
  published:  boolean
  view_count: number
  created_at: string
}

function categoryLabel(cat: string): string {
  return (cat || 'general').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

// Theme-aware Badge variant per category (replaces the old hardcoded light
// bg-*-100/text-*-700 chips that glowed on the dark theme).
function categoryVariant(cat: string): 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'gray' {
  const map: Record<string, 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'gray'> = {
    policy: 'blue', hr: 'purple', finance: 'green', operations: 'yellow', compliance: 'red', product: 'blue',
  }
  return map[(cat || '').toLowerCase()] ?? 'gray'
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-ZA', { year: 'numeric', month: 'short', day: 'numeric' })
}

export function KnowledgeBaseTable({ rows, tenantSlug }: { rows: KbArticle[]; tenantSlug: string }) {
  const [selected, setSelected] = useState<KbArticle | null>(null)

  const categories = Array.from(new Set(rows.map(r => r.category || 'general')))

  const columns: Column<KbArticle>[] = [
    {
      key: 'title',
      header: 'Title',
      render: a => (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{a.title}</span>
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      accessor: a => a.category ?? 'general',
      csv: a => categoryLabel(a.category),
      render: a => <Badge variant={categoryVariant(a.category)}>{categoryLabel(a.category)}</Badge>,
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
        <div className="flex items-center gap-2 justify-end">
          <button
            onClick={e => { e.stopPropagation(); setSelected(a) }}
            className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md transition-colors hover:bg-[var(--surface-hover)]"
            style={{ color: 'var(--indigo-light)' }}
          >
            <Eye className="w-3.5 h-3.5" /> Read
          </button>
          {a.published && (
            <a
              href={`/kb/${tenantSlug}/${a.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md transition-colors hover:bg-[var(--surface-hover)]"
              style={{ color: 'var(--text-muted)' }}
              title={`/kb/${tenantSlug}/${a.slug}`}
            >
              <ExternalLink className="w-3.5 h-3.5" /> Public
            </a>
          )}
        </div>
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
          options: categories.map(c => ({ value: c, label: categoryLabel(c) })),
          predicate: (a: KbArticle, v: string) => (a.category || 'general') === v,
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
        searchExtra={a => a.body ?? ''}
        initialSort={{ key: 'created_at', dir: 'desc' }}
        csvFilename="knowledge-base.csv"
        pageSize={25}
        emptyState={
          <div>
            <p className="text-4xl mb-3">📚</p>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              No knowledge base articles yet. Create your first article to help customers self-serve.
            </p>
          </div>
        }
      />

      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected?.title ?? 'Article'} size="lg">
        {selected && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={categoryVariant(selected.category)}>{categoryLabel(selected.category)}</Badge>
              <Badge variant={selected.published ? 'green' : 'gray'}>{selected.published ? 'Published' : 'Draft'}</Badge>
              <span className="text-xs" style={{ color: 'var(--text-dim)' }}>{formatDate(selected.created_at)}</span>
              {selected.published && (
                <a href={`/kb/${tenantSlug}/${selected.slug}`} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs" style={{ color: 'var(--indigo-light)' }}>
                  <ExternalLink className="w-3 h-3" /> View public page
                </a>
              )}
            </div>
            <div
              className="text-sm whitespace-pre-wrap leading-relaxed rounded-xl p-4"
              style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}
            >
              {selected.body || <span style={{ color: 'var(--text-dim)' }}>This article has no content yet.</span>}
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}
