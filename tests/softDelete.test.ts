import test from 'node:test'
import assert from 'node:assert/strict'
import { softDelete, restore, live } from '../lib/db/softDelete.ts'

function fakeDb(result: { data: unknown; error: unknown }) {
  const calls: unknown[][] = []
  const chain: any = {
    eq: (...a: unknown[]) => { calls.push(['eq', ...a]); return chain },
    is: (...a: unknown[]) => { calls.push(['is', ...a]); return chain },
    not: (...a: unknown[]) => { calls.push(['not', ...a]); return chain },
    select: (...a: unknown[]) => { calls.push(['select', ...a]); return { maybeSingle: async () => result } },
  }
  const db = {
    from: (t: string) => {
      calls.push(['from', t])
      return { update: (v: Record<string, unknown>) => { calls.push(['update', v]); return chain } }
    },
  }
  return { db, calls }
}

test('softDelete sets deleted_at, scoped to id + tenant + still-live', async () => {
  const { db, calls } = fakeDb({ data: { id: 'c1' }, error: null })
  assert.equal(await softDelete(db, 'contacts', { id: 'c1', tenantId: 't1' }), true)
  assert.deepEqual(calls[0], ['from', 'contacts'])
  const update = calls[1][1] as Record<string, unknown>
  assert.ok(typeof update.deleted_at === 'string' && !Number.isNaN(Date.parse(update.deleted_at)))
  assert.deepEqual(calls.slice(2, 5), [['eq', 'id', 'c1'], ['eq', 'tenant_id', 't1'], ['is', 'deleted_at', null]])
})

test('softDelete returns false when nothing matched (wrong tenant / already deleted)', async () => {
  const { db } = fakeDb({ data: null, error: null })
  assert.equal(await softDelete(db, 'contacts', { id: 'c1', tenantId: 't2' }), false)
})

test('softDelete throws DB errors for withRoute to map', async () => {
  const { db } = fakeDb({ data: null, error: { code: '42501', message: 'denied' } })
  await assert.rejects(softDelete(db, 'contacts', { id: 'c1', tenantId: 't1' }), (e: any) => e.code === '42501')
})

test('restore clears deleted_at only on deleted rows', async () => {
  const { db, calls } = fakeDb({ data: { id: 'c1' }, error: null })
  assert.equal(await restore(db, 'contacts', { id: 'c1', tenantId: 't1' }), true)
  assert.deepEqual(calls[1], ['update', { deleted_at: null }])
  assert.deepEqual(calls[4], ['not', 'deleted_at', 'is', null])
})

test('live() filters deleted rows', () => {
  const seen: unknown[] = []
  const q = { is(c: string, v: null) { seen.push([c, v]); return q } }
  live(q)
  assert.deepEqual(seen, [['deleted_at', null]])
})
