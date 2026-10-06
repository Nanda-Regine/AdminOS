// PostgREST caps every response at `max_rows` (Supabase default: 1000). Any
// unpaginated `.select()` over a table that can grow past that — tenants, above
// all — silently returns only the first 1000 rows with no error. Crons that
// fan out "to every tenant" then skip everyone after #1000.
//
// Pass a builder that applies `.range(from, to)` to a query with a STABLE
// order (e.g. `.order('id')`), otherwise pages can overlap or skip rows.

const PAGE_SIZE = 1000

type PageResult<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>

export async function fetchAll<T>(page: (from: number, to: number) => PageResult<T>): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1)
    if (error) throw new Error(`fetchAll: ${error.message}`)
    if (!data?.length) break
    rows.push(...data)
    if (data.length < PAGE_SIZE) break
  }
  return rows
}

/**
 * Drop-in for an aggregate `await query` that must see every row: same
 * `{ data, error }` result, paged underneath. Use it wherever rows are summed
 * or counted in code — totals, debtors, revenue, forecasts — so a tenant's
 * 1001st invoice (a busy shop's Quick Sales pass 1000 within weeks) still counts.
 *
 *   const { data } = await allRows((from, to) =>
 *     supabaseAdmin.from('invoices').select('amount').eq('tenant_id', t).order('id').range(from, to))
 */
export async function allRows<T>(page: (from: number, to: number) => PageResult<T>): Promise<{ data: T[] | null; error: { message: string } | null }> {
  try {
    return { data: await fetchAll(page), error: null }
  } catch (e) {
    return { data: null, error: { message: e instanceof Error ? e.message : String(e) } }
  }
}
