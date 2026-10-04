/**
 * Server-side list contract — one shape for every list that can grow.
 *
 * PostgREST silently caps responses at 1000 rows (lib/supabase/fetchAll.ts),
 * and the 2026-10-04 baseline found 27 tabs with unbounded list queries, so
 * "fetch everything and let DataTable paginate in the browser" stops working
 * — quietly — at a tenant's 1001st invoice. Lists that grow page on the
 * server instead:
 *
 *   URL      ?page=2&pageSize=25&q=acme&sort=due_date&dir=desc&status=overdue
 *   server   const p = parseListParams(searchParams, { sortable: ['due_date', 'total'], filters: ['status'] })
 *            const { data, count } = await applyList(
 *              ctx.db.from('invoices').select('id, number, total', { count: 'exact' }).eq('tenant_id', tid),
 *              p, { search: ['number', 'client_name'] })
 *            return listResult(data ?? [], count, p)
 *   client   <DataTable rows={result.rows} server={result} … />  (syncs back to the URL)
 *
 * Works the same for a page.tsx reading `searchParams` and for a GET route.
 * Import-free apart from zod so tests load it directly.
 */

import { z } from 'zod'

export const MAX_PAGE_SIZE = 100
export const DEFAULT_PAGE_SIZE = 25

export interface ListParams {
  /** 1-based. */
  page: number
  pageSize: number
  q: string
  sort: string | null
  dir: 'asc' | 'desc'
  /** Only keys listed in `filters` survive parsing. */
  filters: Record<string, string>
}

export interface ListResult<T> {
  rows: T[]
  total: number
  page: number
  pageSize: number
  pageCount: number
  q: string
  sort: string | null
  dir: 'asc' | 'desc'
  filters: Record<string, string>
}

const base = z.object({
  page: z.coerce.number().int().min(1).catch(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).catch(DEFAULT_PAGE_SIZE),
  q: z.string().trim().max(100).catch(''),
  sort: z.string().nullable().catch(null),
  dir: z.enum(['asc', 'desc']).catch('desc'),
})

type SearchParamsLike =
  | URLSearchParams
  | Record<string, string | string[] | undefined>

function toRecord(sp: SearchParamsLike): Record<string, string | undefined> {
  if (sp instanceof URLSearchParams) return Object.fromEntries(sp)
  const out: Record<string, string | undefined> = {}
  for (const [k, v] of Object.entries(sp)) out[k] = Array.isArray(v) ? v[0] : v
  return out
}

/**
 * Parse list params. Never throws: a hand-edited URL with ?page=banana gets
 * page 1, not a 400. `sort` is allow-listed — it is interpolated into
 * `.order()`, and an arbitrary column name there is both an error source and a
 * way to probe the schema.
 */
export function parseListParams(
  searchParams: SearchParamsLike,
  opts: { sortable?: readonly string[]; defaultSort?: string; defaultDir?: 'asc' | 'desc'; filters?: readonly string[] } = {},
): ListParams {
  const raw = toRecord(searchParams)
  const parsed = base.parse({
    page: raw.page,
    pageSize: raw.pageSize,
    q: raw.q ?? '',
    sort: raw.sort ?? null,
    dir: raw.dir ?? opts.defaultDir ?? 'desc',
  })

  const sort = parsed.sort && opts.sortable?.includes(parsed.sort) ? parsed.sort : (opts.defaultSort ?? null)

  const filters: Record<string, string> = {}
  for (const key of opts.filters ?? []) {
    const v = raw[key]?.trim()
    if (v) filters[key] = v.slice(0, 100)
  }

  return { ...parsed, sort, filters }
}

/** Inclusive PostgREST range for the page. */
export function pageRange(p: Pick<ListParams, 'page' | 'pageSize'>): [number, number] {
  const from = (p.page - 1) * p.pageSize
  return [from, from + p.pageSize - 1]
}

/**
 * Make a user search term safe inside a PostgREST `or=(col.ilike.*term*)`
 * filter. Commas, parentheses and quotes are PostgREST syntax inside `or()` —
 * left raw, `q=a,tenant_id.neq.x` would inject a filter clause. `*`/`%` are
 * wildcards. Stripping rather than escaping is deliberate: PostgREST's escape
 * rules inside `or()` vary by version, and nobody searches their invoices for
 * a literal parenthesis. `_` is kept — it only widens a match by one char.
 */
export function escapeSearch(term: string): string {
  return term.replace(/[,()"'\\*%:]/g, ' ').replace(/\s+/g, ' ').trim()
}

/** The subset of the supabase-js filter builder applyList needs. */
interface ListQuery<Self> {
  or(filters: string): Self
  eq(column: string, value: string): Self
  order(column: string, opts: { ascending: boolean; nullsFirst?: boolean }): Self
  range(from: number, to: number): Self
}

/**
 * Apply search, filters, sort and range to a query built with
 * `.select(cols, { count: 'exact' })`. Always adds `id` as a tiebreak so
 * pages never overlap or skip rows when the sort column has duplicates.
 */
export function applyList<Q extends ListQuery<Q>>(
  query: Q,
  p: ListParams,
  opts: { search?: readonly string[] } = {},
): Q {
  let q = query
  const term = escapeSearch(p.q)
  if (term && opts.search?.length) {
    q = q.or(opts.search.map((col) => `${col}.ilike.*${term}*`).join(','))
  }
  for (const [key, value] of Object.entries(p.filters)) q = q.eq(key, value)
  if (p.sort) q = q.order(p.sort, { ascending: p.dir === 'asc', nullsFirst: false })
  q = q.order('id', { ascending: true })
  const [from, to] = pageRange(p)
  return q.range(from, to)
}

export function listResult<T>(rows: T[], total: number | null, p: ListParams): ListResult<T> {
  const t = total ?? rows.length
  return {
    rows,
    total: t,
    page: p.page,
    pageSize: p.pageSize,
    pageCount: Math.max(1, Math.ceil(t / p.pageSize)),
    q: p.q,
    sort: p.sort,
    dir: p.dir,
    filters: p.filters,
  }
}
