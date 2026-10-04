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
