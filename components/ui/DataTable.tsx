'use client'

/**
 * DataTable — the shared list surface for AdminOS.
 *
 * One client component that gives every list page the same super-app table:
 * client-side search, per-column sort, filter chips, pagination, CSV export,
 * row click-through, and a real empty state. Token-styled (dark/light aware)
 * so it matches the rest of the dashboard with zero page-level CSS.
 *
 * Usage pattern (App Router): keep `page.tsx` a server component that fetches
 * the rows, then hand them to a small `'use client'` wrapper that defines the
 * `columns` (render fns can't cross the server→client boundary) and renders
 * <DataTable>. See app/dashboard/contacts/ContactsTable.tsx for the reference.
 *
 * Two modes:
 *  - client (default): the page passes every row; search/sort/filter/paginate
 *    happen in the browser. Fine for lists that stay small (staff, branches).
 *  - server: pass `server={listResult(...)}` from lib/api/list.ts and only the
 *    current page's rows. Search, sort, filters and paging are written to the
 *    URL (?q=&sort=&dir=&page=&<filter>=) and the server component re-queries
 *    with .range(). Use it for anything that grows — invoices, contacts,
 *    messages — because PostgREST silently caps a full fetch at 1000 rows.
 *    In server mode a filter's `predicate` is unused (the server filters on
 *    the same `key`, which must be in parseListParams' `filters` list), and
 *    sortable column keys must be in its `sortable` list.
 */

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import type { ListResult } from '@/lib/api/list'
import { Search, ChevronUp, ChevronDown, ChevronsUpDown, Download, ChevronLeft, ChevronRight } from 'lucide-react'

export type Column<T> = {
  /** Stable key, also used as the default sort/search accessor via row[key]. */
  key: string
  header: string
  /** Raw value for sorting, searching and CSV. Falls back to row[key]. */
  accessor?: (row: T) => string | number | null | undefined
  /** Custom cell. Falls back to the accessor value rendered as text. */
  render?: (row: T) => React.ReactNode
  sortable?: boolean
  /** Right-aligns + tabular-nums; numeric sort. Use for money/counts. */
  numeric?: boolean
  align?: 'left' | 'right' | 'center'
  /** Override the CSV cell (defaults to the accessor value). */
  csv?: (row: T) => string | number
  className?: string
  headerClassName?: string
}

export type FilterDef<T> = {
  key: string
  label: string
  options: { value: string; label: string }[]
  predicate: (row: T, value: string) => boolean
}

type DataTableProps<T> = {
  rows: T[]
  columns: Column<T>[]
  getRowKey: (row: T) => string
  searchPlaceholder?: string
  /** Extra text to fold into search beyond the visible column accessors. */
  searchExtra?: (row: T) => string
  filters?: FilterDef<T>[]
  pageSize?: number
  rowHref?: (row: T) => string
  onRowClick?: (row: T) => void
  csvFilename?: string
  emptyState?: React.ReactNode
  initialSort?: { key: string; dir: 'asc' | 'desc' }
  /** Rendered on the right of the toolbar (e.g. an "Add" button). */
  toolbarExtra?: React.ReactNode
  /**
   * Pinned totals row. Receives the currently filtered+sorted rows (the whole
   * matching set, not just the visible page) and returns the <td> cells. Must
   * emit exactly `columns.length` cells.
   */
  renderFooter?: (rows: T[]) => React.ReactNode
  /**
   * Server mode: the list state the server rendered (lib/api/list.ts
   * listResult minus rows). `rows` is then just the current page.
   */
  server?: Omit<ListResult<unknown>, 'rows'>
}

function rawValue<T>(row: T, col: Column<T>): string | number | null | undefined {
  if (col.accessor) return col.accessor(row)
  return (row as Record<string, unknown>)[col.key] as string | number | null | undefined
}

// Text starting with = + - @ runs as a formula in Excel — a contact named
// "=HYPERLINK(...)" would execute on whoever opens the export. Prefix it with '.
// Same rule as lib/money/exports.ts csvCell.
function csvEscape(v: string | number): string {
  let s = String(v ?? '')
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function DataTable<T>({
  rows,
  columns,
  getRowKey,
  searchPlaceholder = 'Search…',
  searchExtra,
  filters = [],
  pageSize = 25,
  rowHref,
  onRowClick,
  csvFilename = 'export.csv',
  emptyState,
  initialSort,
  toolbarExtra,
  renderFooter,
  server,
}: DataTableProps<T>) {
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()
  const [query, setQuery] = useState(server?.q ?? '')
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(
    server ? (server.sort ? { key: server.sort, dir: server.dir } : null) : (initialSort ?? null),
  )
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>(server?.filters ?? {})
  const [page, setPage] = useState(server ? server.page - 1 : 0)

  // --- Server mode: state lives in the URL ---------------------------------
  // Read the live query string at call time (not useSearchParams, which would
  // force every page using DataTable into a Suspense boundary).
  function pushParams(patch: Record<string, string | null>) {
    const params = new URLSearchParams(window.location.search)
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === '') params.delete(k)
      else params.set(k, v)
    }
    const qs = params.toString()
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }))
  }

  // Back/forward navigation changes the URL without going through goToPage.
  useEffect(() => {
    if (server) setPage(server.page - 1)
  }, [server?.page]) // eslint-disable-line react-hooks/exhaustive-deps

  // Debounce search so typing "acme" is one query, not four.
  const firstRender = useRef(true)
  useEffect(() => {
    if (!server) return
    if (firstRender.current) { firstRender.current = false; return }
    const t = setTimeout(() => {
      if (query.trim() !== server.q) pushParams({ q: query.trim() || null, page: null })
    }, 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  // --- Filter ---------------------------------------------------------------
  const filtered = useMemo(() => {
    if (server) return rows
    let out = rows

    for (const f of filters) {
      const val = activeFilters[f.key]
      if (val) out = out.filter(r => f.predicate(r, val))
    }

    const q = query.trim().toLowerCase()
    if (q) {
      out = out.filter(r => {
        const hay = columns
          .map(c => rawValue(r, c))
          .filter(v => v != null)
          .map(v => String(v))
          .join(' ')
          .toLowerCase()
        const extra = searchExtra ? searchExtra(r).toLowerCase() : ''
        return hay.includes(q) || extra.includes(q)
      })
    }
    return out
  }, [rows, columns, filters, activeFilters, query, searchExtra, server])

  // --- Sort -----------------------------------------------------------------
  const sorted = useMemo(() => {
    if (server || !sort) return filtered
    const col = columns.find(c => c.key === sort.key)
    if (!col) return filtered
    const dir = sort.dir === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => {
      const av = rawValue(a, col)
      const bv = rawValue(b, col)
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      if (col.numeric || (typeof av === 'number' && typeof bv === 'number')) {
        return (Number(av) - Number(bv)) * dir
      }
      return String(av).localeCompare(String(bv), 'en-ZA', { numeric: true }) * dir
    })
  }, [filtered, columns, sort, server])

  // --- Paginate -------------------------------------------------------------
  const size = server ? server.pageSize : pageSize
  const totalRows = server ? server.total : sorted.length
  const pageCount = server ? server.pageCount : Math.max(1, Math.ceil(sorted.length / pageSize))
  const safePage = Math.min(page, pageCount - 1)
  const pageRows = server ? sorted : sorted.slice(safePage * pageSize, safePage * pageSize + pageSize)
  const firstRow = totalRows === 0 ? 0 : safePage * size + 1
  const lastRow = Math.min(totalRows, safePage * size + (server ? sorted.length : size))

  function nextSort(prev: { key: string; dir: 'asc' | 'desc' } | null, key: string) {
    if (!prev || prev.key !== key) return { key, dir: 'asc' as const }
    if (prev.dir === 'asc') return { key, dir: 'desc' as const }
    return null
  }

  function toggleSort(key: string) {
    const next = nextSort(sort, key)
    setSort(next)
    if (server) pushParams({ sort: next?.key ?? null, dir: next?.dir ?? null, page: null })
  }

  function goToPage(p: number) {
    setPage(p)
    if (server) pushParams({ page: p === 0 ? null : String(p + 1) })
  }

  function setFilter(key: string, value: string) {
    setActiveFilters(prev => ({ ...prev, [key]: value }))
    setPage(0)
    if (server) pushParams({ [key]: value || null, page: null })
  }

  function clearAll() {
    setQuery('')
    setActiveFilters({})
    setPage(0)
    if (server) {
      const patch: Record<string, null> = { q: null, page: null }
      for (const f of filters) patch[f.key] = null
      pushParams(patch)
    }
  }

  function exportCsv() {
    const header = columns.map(c => csvEscape(c.header)).join(',')
    const body = sorted
      .map(r =>
        columns
          .map(c => csvEscape(c.csv ? c.csv(r) : (rawValue(r, c) ?? '')))
          .join(','),
      )
      .join('\n')
    // Leading UTF-8 BOM so Excel opens ZAR/accented characters correctly.
    const blob = new Blob([`﻿${header}\n${body}`], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = csvFilename
    // Some mobile browsers (iOS Safari in particular) silently no-op a
    // click() on an anchor that was never attached to the document — it
    // has to actually be in the DOM for the download to fire there.
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  function handleRowActivate(row: T) {
    if (onRowClick) return onRowClick(row)
    if (rowHref) router.push(rowHref(row))
  }

  const clickable = Boolean(rowHref || onRowClick)
  const hasActiveFilters = Object.values(activeFilters).some(Boolean) || query.trim().length > 0

  return (
    <div
      className="glass rounded-2xl overflow-hidden transition-opacity"
      style={isPending ? { opacity: 0.6 } : undefined}
      aria-busy={isPending || undefined}
    >
      {/* Toolbar */}
      <div
        className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-4"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
              style={{ color: 'var(--text-muted)' }}
            />
            <input
              value={query}
              onChange={e => {
                setQuery(e.target.value)
                setPage(0)
              }}
              placeholder={searchPlaceholder}
              aria-label="Search table"
              className="pl-8 pr-3 py-1.5 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[var(--indigo)] w-full sm:w-[220px]"
              style={{
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          {/* Filter chips */}
          {filters.map(f => (
            <select
              key={f.key}
              value={activeFilters[f.key] ?? ''}
              onChange={e => setFilter(f.key, e.target.value)}
              aria-label={f.label}
              className="py-1.5 px-3 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[var(--indigo)] cursor-pointer"
              style={{
                background: activeFilters[f.key] ? 'var(--indigo-muted)' : 'var(--surface-2)',
                border: '1px solid var(--border)',
                color: activeFilters[f.key] ? 'var(--indigo-light)' : 'var(--text-secondary)',
              }}
            >
              <option value="">{f.label}: All</option>
              {f.options.map(o => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ))}

          {hasActiveFilters && (
            <button
              onClick={clearAll}
              className="text-xs font-medium px-2 py-1 rounded-md transition-colors"
              style={{ color: 'var(--text-muted)' }}
            >
              Clear
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={exportCsv}
            disabled={sorted.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              color: 'var(--text-secondary)',
            }}
            title={server ? 'Export this page to CSV' : 'Export current view to CSV'}
          >
            <Download className="w-3.5 h-3.5" />
            Export
          </button>
          {toolbarExtra}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}>
              {columns.map(col => {
                const isSorted = sort?.key === col.key
                const sortable = col.sortable !== false
                const align = col.align ?? (col.numeric ? 'right' : 'left')
                return (
                  <th
                    key={col.key}
                    className={`px-5 py-3 text-xs font-semibold uppercase tracking-wide select-none ${
                      align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'
                    } ${sortable ? 'cursor-pointer' : ''} ${col.headerClassName ?? ''}`}
                    style={{ color: isSorted ? 'var(--indigo-light)' : 'var(--text-muted)' }}
                    onClick={sortable ? () => toggleSort(col.key) : undefined}
                    aria-sort={isSorted ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                  >
                    <span className={`inline-flex items-center gap-1 ${align === 'right' ? 'flex-row-reverse' : ''}`}>
                      {col.header}
                      {sortable &&
                        (isSorted ? (
                          sort!.dir === 'asc' ? (
                            <ChevronUp className="w-3 h-3" />
                          ) : (
                            <ChevronDown className="w-3 h-3" />
                          )
                        ) : (
                          <ChevronsUpDown className="w-3 h-3 opacity-40" />
                        ))}
                    </span>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {pageRows.map(row => (
              <tr
                key={getRowKey(row)}
                style={{ borderBottom: '1px solid var(--border)' }}
                className={`transition-colors hover:bg-[rgba(99,102,241,0.05)] ${clickable ? 'cursor-pointer' : ''}`}
                onClick={clickable ? () => handleRowActivate(row) : undefined}
                tabIndex={clickable ? 0 : undefined}
                onKeyDown={
                  clickable
                    ? e => {
                        if (e.key === 'Enter') handleRowActivate(row)
                      }
                    : undefined
                }
              >
                {columns.map(col => {
                  const align = col.align ?? (col.numeric ? 'right' : 'left')
                  return (
                    <td
                      key={col.key}
                      className={`px-5 py-3.5 ${
                        align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'
                      } ${col.numeric ? 'tabular-nums' : ''} ${col.className ?? ''}`}
                    >
                      {col.render ? col.render(row) : (rawValue(row, col) ?? <span style={{ color: 'var(--text-dim)' }}>—</span>)}
                    </td>
                  )
                })}
              </tr>
            ))}

            {totalRows === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-5 py-16 text-center">
                  {hasActiveFilters ? (
                    <div>
                      <p className="font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
                        No matches
                      </p>
                      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                        Try a different search or clear the filters.
                      </p>
                    </div>
                  ) : (
                    emptyState ?? (
                      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                        Nothing here yet.
                      </p>
                    )
                  )}
                </td>
              </tr>
            )}
          </tbody>
          {renderFooter && sorted.length > 0 && (
            <tfoot>
              <tr
                style={{ borderTop: '2px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}
                className="font-semibold"
              >
                {renderFooter(sorted)}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Footer / pagination */}
      {totalRows > 0 && (
        <div
          className="flex items-center justify-between px-6 py-3 text-xs"
          style={{ borderTop: '1px solid var(--border)', color: 'var(--text-muted)' }}
        >
          <span>
            {firstRow}–{lastRow} of {totalRows}
          </span>
          {pageCount > 1 && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => goToPage(Math.max(0, safePage - 1))}
                disabled={safePage === 0}
                className="inline-flex items-center justify-center w-7 h-7 rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[var(--surface-hover)]"
                aria-label="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2 tabular-nums">
                {safePage + 1} / {pageCount}
              </span>
              <button
                onClick={() => goToPage(Math.min(pageCount - 1, safePage + 1))}
                disabled={safePage >= pageCount - 1}
                className="inline-flex items-center justify-center w-7 h-7 rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[var(--surface-hover)]"
                aria-label="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
