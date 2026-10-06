import test from 'node:test'
import assert from 'node:assert/strict'
import { fetchAll } from '../lib/supabase/fetchAll.ts'

// Simulates PostgREST: honours .range(from, to) but never returns more than 1000.
function fakeTable(total: number) {
  const calls: Array<[number, number]> = []
  const page = async (from: number, to: number) => {
    calls.push([from, to])
    const end = Math.min(to, from + 999, total - 1)
    const data = from > end ? [] : Array.from({ length: end - from + 1 }, (_, i) => ({ id: from + i }))
    return { data, error: null }
  }
  return { page, calls }
}

test('returns every row past the 1000-row cap', async () => {
  const { page, calls } = fakeTable(2500)
  const rows = await fetchAll(page)
  assert.equal(rows.length, 2500)
  assert.equal(new Set(rows.map((r) => r.id)).size, 2500)
  assert.deepEqual(calls, [[0, 999], [1000, 1999], [2000, 2999]])
})

test('exact multiple of the page size makes one extra empty call', async () => {
  const { page, calls } = fakeTable(2000)
  assert.equal((await fetchAll(page)).length, 2000)
  assert.equal(calls.length, 3)
})

test('empty table returns []', async () => {
  assert.deepEqual(await fetchAll(fakeTable(0).page), [])
})

test('surfaces query errors instead of returning a partial list', async () => {
  await assert.rejects(
    fetchAll(async () => ({ data: null, error: { message: 'boom' } })),
    /boom/,
  )
})

test('allRows: every page, in the { data, error } shape', async () => {
  const { allRows } = await import('../lib/supabase/fetchAll.ts')
  const rows = Array.from({ length: 2500 }, (_, i) => ({ amount: i }))
  const page = (from: number, to: number) => Promise.resolve({ data: rows.slice(from, to + 1), error: null })
  const r = await allRows(page)
  assert.equal(r.error, null)
  assert.equal(r.data!.length, 2500)
  const failing = () => Promise.resolve({ data: null, error: { message: 'boom' } })
  assert.match((await allRows(failing)).error!.message, /boom/)
})
