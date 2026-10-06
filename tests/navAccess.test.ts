import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { sastDate, sastHour, sastDayStartUTC, sastMonthStartUTC, greetingFor } from '../lib/time/sast.ts'
import { DEFAULT_ROLE_PERMISSIONS } from '../lib/auth/roleMatrix.ts'

// ── SAST ────────────────────────────────────────────────────────────────────
test('23:30 UTC is already tomorrow in SAST', () => {
  const t = new Date('2026-10-06T23:30:00Z')
  assert.equal(sastDate(t), '2026-10-07')
  assert.equal(sastHour(t), 1)
})

test('SAST day and month starts are 22:00 UTC the day before', () => {
  assert.equal(sastDayStartUTC('2026-10-07'), '2026-10-06T22:00:00.000Z')
  assert.equal(sastMonthStartUTC(new Date('2026-10-31T23:00:00Z')), '2026-10-31T22:00:00.000Z')
})

test('greeting follows SAST hour, not UTC', () => {
  assert.equal(greetingFor(sastHour(new Date('2026-10-06T10:30:00Z'))), 'Good afternoon') // 12:30 SAST
})

// ── Nav ↔ page gates ─────────────────────────────────────────────────────────
// features.ts imports lucide icons; parse the registry as text so the test
// stays dependency-free and checks the source of truth directly.
const src = readFileSync('lib/nav/features.ts', 'utf8')
const entries = [...src.matchAll(/\{ href: '([^']+)',[^\n]*?\}/g)].map(m => {
  const req = m[0].match(/requires: (\[[^\]]*\]|'[a-z_]+')/)
  const perms = req ? [...req[1].matchAll(/'([a-z_]+)'/g)].map(x => x[1]) : []
  return { href: m[1], perms }
})

test('every nav entry was parsed', () => {
  assert.ok(entries.length >= 49, `parsed ${entries.length}`)
})

test('each nav entry requires exactly what its page (or segment layout) checks', () => {
  for (const { href, perms } of entries) {
    const dir = `app${href}`
    const files = [`${dir}/page.tsx`, `${dir}/layout.tsx`].filter(existsSync)
    const code = files.map(f => readFileSync(f, 'utf8')).join('\n')
    const checked = new Set([...code.matchAll(/checkPermission\('([a-z_]+)'\)/g)].map(m => m[1]))
    for (const p of perms) {
      assert.ok(checked.has(p), `${href} requires ${p} in the nav but its page never checks it`)
    }
    if (perms.length === 0) {
      assert.equal(checked.size, 0, `${href} is gated (${[...checked]}) but the nav shows it to everyone`)
    }
  }
})

const visibleTo = (role: keyof typeof DEFAULT_ROLE_PERMISSIONS) =>
  entries.filter(e => e.perms.length === 0 || e.perms.some(p => (DEFAULT_ROLE_PERMISSIONS[role] as string[]).includes(p))).map(e => e.href)

test('a field agent sees a short, workable nav — no money, payroll or settings', () => {
  const nav = visibleTo('field_agent')
  for (const forbidden of ['/dashboard/payroll', '/dashboard/money', '/dashboard/cashflow', '/dashboard/settings', '/dashboard/invoices', '/dashboard/staff']) {
    assert.ok(!nav.includes(forbidden), `field_agent can see ${forbidden}`)
  }
  assert.ok(nav.includes('/dashboard/tasks'))
  assert.ok(nav.length <= 10, `field_agent nav has ${nav.length} entries`)
})

test('a manager sees no payroll; an owner sees everything', () => {
  assert.ok(!visibleTo('manager').includes('/dashboard/payroll'))
  assert.equal(visibleTo('owner').length, entries.length)
})
