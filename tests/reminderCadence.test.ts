import test from 'node:test'
import assert from 'node:assert/strict'
import { reminderTooSoon } from '../lib/debt/cadence.ts'

const now = new Date('2026-10-24T08:00:00Z')
const ago = (h: number) => new Date(now.getTime() - h * 3600_000).toISOString()

test('never reminded: not too soon', () => {
  assert.equal(reminderTooSoon(null, false, now), false)
  assert.equal(reminderTooSoon(undefined, true, now), false)
})

test('the daily sweep cannot chase the same invoice again the next morning', () => {
  assert.equal(reminderTooSoon(ago(24), false, now), true)
  assert.equal(reminderTooSoon(ago(71), false, now), true)
  assert.equal(reminderTooSoon(ago(73), false, now), false)
})

test('the manual button is blocked for a day, then allowed', () => {
  assert.equal(reminderTooSoon(ago(1), true, now), true)
  assert.equal(reminderTooSoon(ago(25), true, now), false)
})

test('an unreadable timestamp does not block', () => {
  assert.equal(reminderTooSoon('not a date', false, now), false)
})
