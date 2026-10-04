import test from 'node:test'
import assert from 'node:assert/strict'
import { parseListParams, pageRange, escapeSearch, applyList, listResult, MAX_PAGE_SIZE } from '../lib/api/list.ts'

test('defaults', () => {
  assert.deepEqual(parseListParams(new URLSearchParams()), {
    page: 1, pageSize: 25, q: '', sort: null, dir: 'desc', filters: {},
  })
})

test('garbage never throws — it falls back', () => {
  const p = parseListParams({ page: 'banana', pageSize: '-3', dir: 'sideways' })
  assert.equal(p.page, 1)
  assert.equal(p.pageSize, 25)
  assert.equal(p.dir, 'desc')
})

test('pageSize is capped', () => {
  assert.equal(parseListParams({ pageSize: '5000' }).pageSize, 25) // out of range → default, not max
  assert.equal(parseListParams({ pageSize: String(MAX_PAGE_SIZE) }).pageSize, MAX_PAGE_SIZE)
})

test('sort is allow-listed; unknown columns fall back to the default', () => {
  const opts = { sortable: ['due_date', 'total'], defaultSort: 'created_at' }
  assert.equal(parseListParams({ sort: 'total' }, opts).sort, 'total')
  assert.equal(parseListParams({ sort: 'tenant_id' }, opts).sort, 'created_at')
})

test('only declared filters survive; Next array params take the first value', () => {
  const p = parseListParams({ status: ['overdue', 'paid'], tenant_id: 'other' }, { filters: ['status'] })
  assert.deepEqual(p.filters, { status: 'overdue' })
})

test('pageRange is inclusive and 1-based', () => {
  assert.deepEqual(pageRange({ page: 1, pageSize: 25 }), [0, 24])
  assert.deepEqual(pageRange({ page: 3, pageSize: 10 }), [20, 29])
})

test('escapeSearch strips PostgREST or() syntax so search cannot inject filters', () => {
  assert.equal(escapeSearch('a,tenant_id.neq.x'), 'a tenant_id.neq.x')
  assert.doesNotMatch(escapeSearch('x),or(id.gt.0'), /[(),]/)
  assert.equal(escapeSearch("O'Brien & Sons"), 'O Brien & Sons')
  assert.equal(escapeSearch('  50%*  '), '50')
})

test('applyList: search, filters, sort with id tiebreak, then range', () => {
  const calls: unknown[][] = []
  const q: any = new Proxy({}, {
    get: (_t, prop) => (...args: unknown[]) => { calls.push([prop, ...args]); return q },
  })
  const p = parseListParams(
    { q: 'acme', status: 'paid', sort: 'total', dir: 'asc', page: '2', pageSize: '10' },
    { sortable: ['total'], filters: ['status'] },
  )
  applyList(q, p, { search: ['number', 'client_name'] })
  assert.deepEqual(calls, [
    ['or', 'number.ilike.*acme*,client_name.ilike.*acme*'],
    ['eq', 'status', 'paid'],
    ['order', 'total', { ascending: true, nullsFirst: false }],
    ['order', 'id', { ascending: true }],
    ['range', 10, 19],
  ])
})

test('applyList skips search when the term is empty after escaping', () => {
  const calls: string[] = []
  const q: any = new Proxy({}, { get: (_t, prop) => () => { calls.push(String(prop)); return q } })
  applyList(q, parseListParams({ q: ',,()' }), { search: ['name'] })
  assert.deepEqual(calls, ['order', 'range'])
})

test('listResult computes pageCount and echoes params', () => {
  const p = parseListParams({ page: '2', pageSize: '10' })
  const r = listResult([{ id: 1 }], 31, p)
  assert.equal(r.pageCount, 4)
  assert.equal(r.total, 31)
  assert.equal(r.page, 2)
  assert.equal(listResult([], null, p).pageCount, 1)
})
