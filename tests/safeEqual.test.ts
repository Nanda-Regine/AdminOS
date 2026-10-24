import test from 'node:test'
import assert from 'node:assert/strict'
import { safeEqual } from '../lib/security/safeEqual.ts'

test('equal secrets match', () => {
  assert.equal(safeEqual('hub-secret-123', 'hub-secret-123'), true)
  assert.equal(safeEqual('sha256=abc', 'sha256=abc'), true)
})

test('different secrets, including different lengths, do not match', () => {
  assert.equal(safeEqual('hub-secret-123', 'hub-secret-124'), false)
  assert.equal(safeEqual('short', 'a-much-longer-value'), false)
})

test('missing or empty values never match, even each other', () => {
  assert.equal(safeEqual(null, null), false)
  assert.equal(safeEqual(undefined, undefined), false)
  assert.equal(safeEqual('', ''), false)
  assert.equal(safeEqual('x', null), false)
  assert.equal(safeEqual(undefined, 'x'), false)
})
