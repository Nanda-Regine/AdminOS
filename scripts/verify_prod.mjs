// Runtime verification against live production. Safe to re-run after each deploy.
//   node scripts/verify_prod.mjs
// Exercises: homepage, health, test-account login, RLS tenant isolation, and the
// billing catalogue DB state. Exits non-zero if a CRITICAL check fails; infra
// health (redis/inngest) is reported as a warning, not a failure.
import fs from 'fs'

const env = Object.fromEntries(
  fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split(/\r?\n/).filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] }))

const U = env.NEXT_PUBLIC_SUPABASE_URL, A = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const MT = env.SUPABASE_ACCESS_TOKEN, APP = env.NEXT_PUBLIC_APP_URL || 'https://www.adminos.co.za'
const REF = 'aetydnhnxmrsgqaqtofc'
const TEST_EMAIL = 'founder@adminos-demo.co.za', TEST_PW = 'AdminOS-Test-2026!'

let pass = 0, fail = 0, warn = 0
const ok = (m) => { pass++; console.log('  ✓', m) }
const bad = (m) => { fail++; console.log('  ✗ FAIL:', m) }
const wrn = (m) => { warn++; console.log('  ⚠', m) }

async function sql(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST', headers: { Authorization: `Bearer ${MT}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  return r.json()
}

console.log('\n== AdminOS production verification ==')

// 1. Homepage
console.log('\n[web]')
try {
  const r = await fetch(APP + '/'); r.status === 200 ? ok('homepage 200') : bad(`homepage ${r.status}`)
} catch (e) { bad('homepage unreachable: ' + e.message) }

// 2. Health (report; infra checks are warnings)
try {
  const h = await (await fetch(APP + '/api/health')).json()
  h.checks?.database === 'ok' ? ok('health: database ok') : bad('health: database ' + h.checks?.database)
  for (const k of ['redis', 'inngest']) {
    const v = h.checks?.[k]
    v === 'ok' || v === 'configured' ? ok(`health: ${k} ${v}`) : wrn(`health: ${k} = ${v} (infra follow-up)`)
  }
} catch (e) { bad('health unreachable: ' + e.message) }

// 3. Test-account login + JWT claim source
console.log('\n[auth + tenant isolation]')
let token = null, myTenant = null
try {
  const t = await (await fetch(`${U}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: A, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PW }),
  })).json()
  token = t.access_token
  if (!token) { bad('test login failed: ' + JSON.stringify(t)) }
  else {
    const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString())
    myTenant = claims.app_metadata?.tenant_id
    myTenant ? ok('login ok; tenant_id in app_metadata') : bad('no app_metadata.tenant_id in JWT')
    claims.user_metadata?.tenant_id ? bad('tenant_id leaked into user_metadata') : ok('no tenant_id in user_metadata')
  }
} catch (e) { bad('login error: ' + e.message) }

// 4. RLS isolation
if (token && myTenant) {
  const mine = await (await fetch(`${U}/rest/v1/tenants?select=id`, { headers: { apikey: A, Authorization: `Bearer ${token}` } })).json()
  Array.isArray(mine) && mine.length === 1 && mine[0].id === myTenant ? ok('RLS: sees only own tenant') : bad('RLS: unexpected tenant visibility ' + JSON.stringify(mine))
  const other = (await sql(`select id from tenants where id <> '${myTenant}' limit 1;`))[0]?.id
  if (other) {
    const cross = await (await fetch(`${U}/rest/v1/tenants?select=id&id=eq.${other}`, { headers: { apikey: A, Authorization: `Bearer ${token}` } })).json()
    Array.isArray(cross) && cross.length === 0 ? ok('RLS: foreign tenant read blocked') : bad('RLS: cross-tenant read returned rows!')
  }
}

// 5. Billing catalogue DB state
console.log('\n[billing catalogue]')
try {
  const addons = await sql(`select slug from addon_catalogue where active order by slug;`)
  const slugs = addons.map(a => a.slug).sort().join(',')
  slugs === 'client_portal,languages,reach,ring,sage' ? ok('addon_catalogue = canonical 5') : bad('addon_catalogue slugs = ' + slugs)
  const plans = await sql(`select slug, included_addons from plan_catalogue order by price_monthly;`)
  const grow = plans.find(p => p.slug === 'grow')?.included_addons || []
  const partner = plans.find(p => p.slug === 'partner')?.included_addons || []
  grow.includes('languages') ? ok('bundling: Grow includes languages') : bad('bundling: Grow ladder wrong')
  partner.length === 5 ? ok('bundling: Partner includes all 5') : bad('bundling: Partner ladder = ' + partner.join(','))
  const orphan = (await sql(`select to_regclass('public.addon_subscriptions') as t;`))[0]?.t
  orphan === null ? ok('orphan addon_subscriptions dropped') : bad('addon_subscriptions still exists')
} catch (e) { bad('catalogue check error: ' + e.message) }

console.log(`\n== ${pass} passed, ${fail} failed, ${warn} warnings ==`)
process.exit(fail > 0 ? 1 : 0)
