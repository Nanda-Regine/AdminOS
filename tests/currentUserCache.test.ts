import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// Guard-rails for the first-load work: these are structural because the
// helpers need a live Supabase session to run. They fail if someone puts the
// repeated getUser() / sequential reads back.
const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

test('getContext is memoised per request and fetches role + super-admin together', () => {
  const src = read('lib/auth/context.ts')
  assert.match(src, /export const getContext = cache\(/)
  assert.match(src, /Promise\.all\(\[\s*checkSuperAdmin\(user\.id\),\s*getUserPermissions\(/)
})

test('layout and dashboard page share one getUser per request', () => {
  for (const p of ['app/dashboard/layout.tsx', 'app/dashboard/page.tsx']) {
    const src = read(p)
    assert.match(src, /getCurrentUser/, p)
    assert.doesNotMatch(src, /auth\.getUser\(\)/, `${p} must not call getUser directly`)
  }
})

test('the dashboard page no longer publishes five signals on every view', () => {
  assert.doesNotMatch(read('app/dashboard/page.tsx'), /publishSignal\(/)
})
