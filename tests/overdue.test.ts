import test from 'node:test'
import assert from 'node:assert/strict'
import { daysOverdue, todayDateString } from '../lib/debt/overdue.ts'

const NOW = new Date('2026-07-18T09:00:00Z')

test('counts whole days a due date is past (UTC)', () => {
  assert.equal(daysOverdue('2026-07-08', NOW), 10)
  assert.equal(daysOverdue('2026-07-17', NOW), 1)
})

test('not-yet-due and due-today floor at 0', () => {
  assert.equal(daysOverdue('2026-07-18', NOW), 0)
  assert.equal(daysOverdue('2026-08-01', NOW), 0)
})

test('missing or invalid dates are 0, never negative or NaN', () => {
  assert.equal(daysOverdue(null, NOW), 0)
  assert.equal(daysOverdue(undefined, NOW), 0)
  assert.equal(daysOverdue('not-a-date', NOW), 0)
})

test('todayDateString is YYYY-MM-DD', () => {
  assert.equal(todayDateString(NOW), '2026-07-18')
})
