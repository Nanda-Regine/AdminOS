import { test } from 'node:test'
import assert from 'node:assert/strict'
import { effectiveStatus } from '../lib/compliance/status.ts'

const NOW = new Date('2026-10-24T09:00:00Z')

test('a past due date is overdue even if the stored status is stale "upcoming"', () => {
  assert.equal(effectiveStatus('upcoming', '2026-10-08', 30, NOW), 'overdue')
  assert.equal(effectiveStatus('due', '2026-09-07', 30, NOW), 'overdue')
})

test('due inside the alert window, upcoming beyond it', () => {
  assert.equal(effectiveStatus('upcoming', '2026-11-07', 30, NOW), 'due')
  assert.equal(effectiveStatus('due', '2026-12-31', 30, NOW), 'upcoming')
  assert.equal(effectiveStatus('upcoming', '2026-10-24', 30, NOW), 'due')
})

test('completed and not_applicable are never overridden', () => {
  assert.equal(effectiveStatus('completed', '2026-01-01', 30, NOW), 'completed')
  assert.equal(effectiveStatus('not_applicable', '2026-01-01', 30, NOW), 'not_applicable')
})

test('no due date is upcoming', () => {
  assert.equal(effectiveStatus('overdue', null, 30, NOW), 'upcoming')
})
