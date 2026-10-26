import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildBehaviour, pickBehaviour, expectedCollection, contactKey, defaultProbability, MIN_CONTACT, MIN_TENANT,
} from '../lib/invoices/paymentBehaviour.ts'

const s = (key: string, dueDate: string, paidOn: string) => ({ key, dueDate, paidOn })

test('contactKey prefers the id, falls back to a normalised name, null when nothing', () => {
  assert.equal(contactKey('abc', 'Thandi'), 'c:abc')
  assert.equal(contactKey(null, '  Thandi   Nkosi '), 'n:thandi nkosi')
  assert.equal(contactKey(null, ''), null)
})

test('a customer needs MIN_CONTACT paid invoices before their own pattern is used', () => {
  const two = buildBehaviour([s('a', '2026-01-01', '2026-01-11'), s('a', '2026-02-01', '2026-02-11')])
  assert.equal(two.byKey.has('a'), false)
  assert.equal(two.tenant, null) // 2 < MIN_TENANT
  const three = buildBehaviour([s('a', '2026-01-01', '2026-01-11'), s('a', '2026-02-01', '2026-02-11'), s('a', '2026-03-01', '2026-03-11')])
  assert.equal(three.byKey.get('a')?.medianDaysLate, 10)
  assert.equal(three.byKey.get('a')?.lateRate, 1)
  assert.equal(MIN_CONTACT, 3)
})

test('median, late rate and the clamp on a single huge outlier', () => {
  const m = buildBehaviour([
    s('a', '2026-01-10', '2026-01-05'), // 5 early
    s('a', '2026-02-10', '2026-02-10'), // on time
    s('a', '2026-03-10', '2027-03-10'), // a year late
  ])
  const b = m.byKey.get('a')!
  assert.equal(b.medianDaysLate, 0)
  assert.equal(Math.round(b.lateRate * 100), 33)
  const c = buildBehaviour(Array.from({ length: 3 }, (_, i) => s('x', `2026-0${i + 1}-01`, `2027-0${i + 1}-01`)))
  assert.equal(c.byKey.get('x')?.medianDaysLate, 90)
})

test('business-wide pattern needs MIN_TENANT samples and is the fallback for unknown customers', () => {
  const samples = Array.from({ length: MIN_TENANT }, (_, i) => s(`k${i}`, '2026-01-01', '2026-01-08'))
  const m = buildBehaviour(samples)
  assert.equal(m.byKey.size, 0)
  assert.equal(pickBehaviour(m, 'new')?.scope, 'tenant')
  assert.equal(pickBehaviour(buildBehaviour([]), 'new'), null)
})

test('no history → the old default curve and dates', () => {
  const c = expectedCollection({ dueDate: '2026-11-10' }, '2026-11-01', null)
  assert.deepEqual(c, { date: '2026-11-10', probability: 0.85, basis: 'default' })
  const od = expectedCollection({ dueDate: '2026-10-01' }, '2026-11-01', null) // 31 days over
  assert.equal(od.date, '2026-11-04') // today + max(3, min(14, -1)) = +3, never in the past
  assert.equal(od.probability, defaultProbability(31))
})

test('a reliable customer is dated near their usual day with better odds; a chronically late one gets worse odds', () => {
  const reliable = buildBehaviour(Array.from({ length: 4 }, (_, i) => s('r', `2026-0${i + 1}-10`, `2026-0${i + 1}-09`)))
  const c = expectedCollection({ dueDate: '2026-11-10' }, '2026-11-01', pickBehaviour(reliable, 'r'))
  assert.equal(c.date, '2026-11-09')
  assert.equal(c.basis, 'customer')
  assert.equal(c.probability, 0.95)

  const late = buildBehaviour(Array.from({ length: 4 }, (_, i) => s('l', `2026-0${i + 1}-10`, `2026-0${i + 1}-30`)))
  const l = expectedCollection({ dueDate: '2026-11-10' }, '2026-11-01', pickBehaviour(late, 'l'))
  assert.equal(l.date, '2026-11-30')
  assert.ok(l.probability < 0.85)
})

test('predicted date already passed → never dated in the past', () => {
  const m = buildBehaviour(Array.from({ length: 4 }, (_, i) => s('p', `2026-0${i + 1}-10`, `2026-0${i + 1}-15`)))
  // Due 1 Oct, usually pays 5 days late (6 Oct), but it is 1 Nov and still unpaid.
  const c = expectedCollection({ dueDate: '2026-10-01' }, '2026-11-01', pickBehaviour(m, 'p'))
  assert.ok(c.date > '2026-11-01')
})

test('business-wide pattern moves the date but not the odds', () => {
  const m = buildBehaviour(Array.from({ length: MIN_TENANT }, (_, i) => s(`k${i}`, '2026-01-01', '2026-01-21')))
  const c = expectedCollection({ dueDate: '2026-11-10' }, '2026-11-01', pickBehaviour(m, 'stranger'))
  assert.equal(c.date, '2026-11-30')
  assert.equal(c.probability, 0.85)
  assert.equal(c.basis, 'business')
})
