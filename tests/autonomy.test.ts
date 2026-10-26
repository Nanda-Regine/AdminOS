import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveTier, canAutoAct, isSurfaceOnly, isWithinQuietHours } from '../lib/autonomy/tiers.ts'

test('tenant config wins over defaults', () => {
  const rows = [{ domain: 'money', decision_type: 'invoice_reminder', tier: 'C' as const }]
  assert.equal(resolveTier(rows, 'money', 'invoice_reminder'), 'C')
})

test('falls back to per-decision default (preserves current behaviour)', () => {
  assert.equal(resolveTier([], 'money', 'invoice_reminder'), 'A')   // recovery auto-sends today
  assert.equal(resolveTier([], 'money', 'final_demand'), 'C')       // legally sensitive → never auto
  assert.equal(resolveTier([], 'ops', 'low_stock_reorder_alert'), 'A')
})

test('unknown decision defaults to C (safest)', () => {
  assert.equal(resolveTier([], 'money', 'wire_transfer'), 'C')
  assert.equal(resolveTier([], 'unknown', 'thing'), 'C')
})

test('tier helpers', () => {
  assert.equal(canAutoAct('A'), true)
  assert.equal(canAutoAct('B'), false)
  assert.equal(isSurfaceOnly('C'), true)
})

test('quiet hours handle overnight wrap', () => {
  const overnight = { start: 21 * 60, end: 6 * 60 } // 21:00 → 06:00
  assert.equal(isWithinQuietHours(22 * 60, overnight), true)   // 22:00 quiet
  assert.equal(isWithinQuietHours(3 * 60, overnight), true)    // 03:00 quiet
  assert.equal(isWithinQuietHours(12 * 60, overnight), false)  // noon not quiet
  const daytime = { start: 9 * 60, end: 17 * 60 }
  assert.equal(isWithinQuietHours(12 * 60, daytime), true)
  assert.equal(isWithinQuietHours(20 * 60, daytime), false)
  assert.equal(isWithinQuietHours(12 * 60, null), false)
})

test('bank statement matching proposes by default and is a governed decision', async () => {
  const { DECISION_CATALOGUE } = await import('../lib/autonomy/tiers.ts')
  assert.equal(resolveTier([], 'money', 'bank_auto_match'), 'B') // propose, never silently settle
  assert.ok(DECISION_CATALOGUE.some((d) => d.domain === 'money' && d.decision_type === 'bank_auto_match'))
  assert.equal(resolveTier([{ domain: 'money', decision_type: 'bank_auto_match', tier: 'A' }], 'money', 'bank_auto_match'), 'A')
})
