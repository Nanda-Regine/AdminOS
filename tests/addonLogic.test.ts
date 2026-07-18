import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveEntitledAddons, isAddonSlug } from '../lib/billing/addonLogic.ts'

const NOW = 1_700_000_000_000
const future = new Date(NOW + 86_400_000).toISOString()
const past = new Date(NOW - 86_400_000).toISOString()

test('bundled add-ons come from the plan', () => {
  assert.deepEqual(resolveEntitledAddons(['languages'], null, NOW), ['languages'])
})

test('paid + active + unexpired counts', () => {
  assert.deepEqual(
    resolveEntitledAddons(null, { addon_ring: true, addon_ring_expires_at: future }, NOW),
    ['ring'],
  )
})

test('paid but expired does NOT count', () => {
  assert.deepEqual(
    resolveEntitledAddons(null, { addon_ring: true, addon_ring_expires_at: past }, NOW),
    [],
  )
})

test('paid with no expiry counts (open-ended)', () => {
  assert.deepEqual(resolveEntitledAddons(null, { addon_reach: true }, NOW), ['reach'])
})

test('bundle + paid are unioned and de-duplicated', () => {
  const r = resolveEntitledAddons(['reach'], { addon_reach: true, addon_ring: true }, NOW).sort()
  assert.deepEqual(r, ['reach', 'ring'])
})

test('non-canonical bundle slugs are ignored', () => {
  assert.deepEqual(resolveEntitledAddons(['payroll_module', 'esignature'], null, NOW), [])
})

test('addon_<slug> that is false is not entitled', () => {
  assert.deepEqual(resolveEntitledAddons(null, { addon_sage: false }, NOW), [])
})

test('isAddonSlug guards the canonical five', () => {
  assert.ok(isAddonSlug('client_portal'))
  assert.ok(!isAddonSlug('white_label'))
})
