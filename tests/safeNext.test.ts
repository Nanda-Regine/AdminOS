import test from 'node:test'
import assert from 'node:assert/strict'
import { safeNextPath } from '../lib/auth/safeNext.ts'

test('same-site paths pass through', () => {
  assert.equal(safeNextPath('/dashboard/invoices'), '/dashboard/invoices')
  assert.equal(safeNextPath('/dashboard/bank?status=matched'), '/dashboard/bank?status=matched')
  assert.equal(safeNextPath('/'), '/')
})

test('missing or empty falls back', () => {
  assert.equal(safeNextPath(null), '/dashboard')
  assert.equal(safeNextPath(undefined), '/dashboard')
  assert.equal(safeNextPath(''), '/dashboard')
  assert.equal(safeNextPath('', '/welcome'), '/welcome')
})

test('open-redirect payloads are refused', () => {
  for (const bad of [
    '@evil.com', 'https://evil.com', 'http://evil.com/x', '//evil.com', '/\\evil.com', '\\\\evil.com',
    'javascript:alert(1)', 'evil.com', '/ok\r\nSet-Cookie: x=1', '/a\\b', '/\u0000',
  ]) {
    assert.equal(safeNextPath(bad), '/dashboard', `should refuse ${JSON.stringify(bad)}`)
  }
})

test('the exact userinfo exploit cannot reach another host', () => {
  const origin = 'https://www.adminos.co.za'
  const url = new URL(`${origin}${safeNextPath('@evil.com')}`)
  assert.equal(url.hostname, 'www.adminos.co.za')
})
