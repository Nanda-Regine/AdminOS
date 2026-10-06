import test from 'node:test'
import assert from 'node:assert/strict'
import { statutoryCalendar, planCalendarSync } from '../lib/compliance/calendar.ts'

const due = (items: ReturnType<typeof statutoryCalendar>, type: string) => items.filter(i => i.item_type === type).map(i => i.due_date)

test('EMP201: the 7th, or the last business day before it — never the 8th or 10th', () => {
  const emp = due(statutoryCalendar({ today: '2026-10-06' }), 'emp201')
  assert.equal(emp.length, 12)
  assert.equal(emp[0], '2026-10-07')     // September payroll, Wednesday
  assert.ok(emp.includes('2026-11-06'))  // 7 Nov 2026 is a Saturday → Friday
  assert.ok(emp.includes('2026-12-07'))  // Monday — the old seed said the 8th
  assert.ok(emp.includes('2027-03-05'))  // 7 Mar 2027 is a Sunday — the old seed said the 10th
  for (const d of emp) assert.ok(d.slice(8) <= '07', d)
})

test('IRP6 and ITR14 follow a February year end by default (SARS)', () => {
  const items = statutoryCalendar({ today: '2026-10-06' })
  assert.deepEqual(due(items, 'irp6_p2'), ['2027-02-26'])  // 28 Feb 2027 is a Sunday → last business day
  assert.deepEqual(due(items, 'irp6_p1'), ['2027-08-31'])
  assert.deepEqual(due(items, 'itr14'), ['2027-02-28'])     // year ended Feb 2026
})

test('a December year end moves IRP6/ITR14 with it', () => {
  const items = statutoryCalendar({ today: '2026-10-06', fyEndMonth: 12 })
  assert.deepEqual(due(items, 'irp6_p2'), ['2026-12-31'])
  assert.deepEqual(due(items, 'irp6_p1'), ['2027-06-30'])
  assert.deepEqual(due(items, 'itr14'), ['2026-12-31'])     // year ended Dec 2025
})

test('EMP501: annual closes 31 May, interim closes 31 October', () => {
  const items = statutoryCalendar({ today: '2026-10-06' })
  assert.deepEqual(due(items, 'emp501_interim'), ['2026-10-31'])
  assert.deepEqual(due(items, 'emp501_annual'), ['2027-05-31'])
  assert.match(items.find(i => i.item_type === 'emp501_annual')!.description, /1 March 2026 – end of February 2027/)
})

test('COIDA Return of Earnings closes 31 May, not 31 March', () => {
  assert.deepEqual(due(statutoryCalendar({ today: '2026-10-06' }), 'coida'), ['2027-05-31'])
})

test('a new tenant gets nothing already overdue', () => {
  for (const i of statutoryCalendar({ today: '2026-10-06' })) assert.ok(i.due_date >= '2026-10-06', i.item_type)
})

test('NPO annual report only for NGOs: nine months after year end', () => {
  assert.deepEqual(due(statutoryCalendar({ today: '2026-10-06' }), 'npo_annual'), [])
  assert.deepEqual(due(statutoryCalendar({ today: '2026-10-06', businessType: 'ngo' }), 'npo_annual'), ['2026-11-30'])
})

test('CIPC annual return only when the incorporation date is known', () => {
  assert.deepEqual(due(statutoryCalendar({ today: '2026-10-06' }), 'cipc_annual'), [])
  assert.deepEqual(due(statutoryCalendar({ today: '2026-10-06', incorporationDate: '2019-03-14' }), 'cipc_annual'), ['2027-03-14'])
})

const row = (id: string, item_type: string, due_date: string, extra: Partial<import('../lib/compliance/calendar.ts').ExistingRow> = {}) =>
  ({ id, item_type, due_date, status: 'upcoming', completed_at: null, deleted_at: null, ...extra })

test('sync: wrong open dates are soft-deleted, right ones kept, missing ones inserted', () => {
  const plan = planCalendarSync([
    row('a', 'emp201', '2026-12-08'),                          // old seed's wrong date
    row('b', 'emp201', '2026-11-06'),                          // right
    row('c', 'irp6_p1', '2026-07-01', { status: 'overdue' }),  // invented overdue
    row('d', 'emp201', '2026-09-07', { status: 'overdue' }),   // genuinely missed (Aug payroll)
    row('e', 'emp501_may', '2027-05-31'),                      // legacy type
    row('f', 'emp201', '2026-08-10', { status: 'completed', completed_at: '2026-08-07T08:00:00Z' }), // done: untouched
    row('g', 'licence_renewal', '2026-12-01'),                 // not ours
  ], { today: '2026-10-06' })
  assert.deepEqual(plan.softDelete.sort(), ['a', 'c', 'e'])
  assert.deepEqual(plan.update.map(u => u.id).sort(), ['b', 'd'])
  assert.ok(plan.insert.some(i => i.item_type === 'emp201' && i.due_date === '2026-12-07'))
  assert.ok(!plan.insert.some(i => i.item_type === 'emp201' && i.due_date === '2026-11-06'))
})

test('sync: a soft-deleted right-date row is revived instead of colliding on the unique key', () => {
  const plan = planCalendarSync([row('x', 'emp201', '2026-12-07', { deleted_at: '2026-10-01T00:00:00Z' })], { today: '2026-10-06' })
  assert.deepEqual(plan.update, [{ id: 'x', item: plan.update[0].item, revive: true }])
  assert.ok(!plan.insert.some(i => i.due_date === '2026-12-07' && i.item_type === 'emp201'))
})
