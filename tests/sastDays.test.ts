import { test } from 'node:test'
import assert from 'node:assert/strict'
import { daysUntil } from '../lib/time/sast.ts'

test('daysUntil counts SAST calendar days, whatever the runtime clock', () => {
  // 00:30 SAST on 7 Oct is 22:30 UTC on 6 Oct — the window the old code got wrong.
  const justAfterMidnightSast = new Date('2026-10-06T22:30:00Z')
  assert.equal(daysUntil('2026-10-07', justAfterMidnightSast), 0)
  assert.equal(daysUntil('2026-10-08', justAfterMidnightSast), 1)
  assert.equal(daysUntil('2026-10-06', justAfterMidnightSast), -1)
  // Across a month and a year end.
  assert.equal(daysUntil('2026-11-01', new Date('2026-10-31T10:00:00Z')), 1)
  assert.equal(daysUntil('2027-01-01', new Date('2026-12-31T21:59:00Z')), 1)
  assert.equal(daysUntil('2027-01-01', new Date('2026-12-31T22:00:00Z')), 0)
})
