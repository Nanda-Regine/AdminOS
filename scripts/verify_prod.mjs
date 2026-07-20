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

async function sql(query, attempt = 0) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST', headers: { Authorization: `Bearer ${MT}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  const j = await r.json().catch(() => null)
  // Management API occasionally returns a transient error object instead of rows.
  if (!Array.isArray(j) && attempt < 2) {
    await new Promise(res => setTimeout(res, 800))
    return sql(query, attempt + 1)
  }
  return Array.isArray(j) ? j : []
}

// Returns the raw response so callers can tell a real SQL error (e.g. missing
// table/column → { message: ... }) apart from an empty result set ([]).
async function sqlRaw(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST', headers: { Authorization: `Bearer ${MT}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  return r.json().catch(() => ({ message: 'unparseable response' }))
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
  slugs === 'client_portal,languages,reach,ring' ? ok('addon_catalogue = canonical 4') : bad('addon_catalogue slugs = ' + slugs)
  const plans = await sql(`select slug, included_addons from plan_catalogue order by price_monthly;`)
  const grow = plans.find(p => p.slug === 'grow')?.included_addons || []
  const partner = plans.find(p => p.slug === 'partner')?.included_addons || []
  grow.includes('languages') ? ok('bundling: Grow includes languages') : bad('bundling: Grow ladder wrong')
  partner.length === 4 ? ok('bundling: Partner includes all 4') : bad('bundling: Partner ladder = ' + partner.join(','))
  const orphan = (await sql(`select to_regclass('public.addon_subscriptions') as t;`))[0]?.t
  orphan === null ? ok('orphan addon_subscriptions dropped') : bad('addon_subscriptions still exists')
} catch (e) { bad('catalogue check error: ' + e.message) }

// 6. Page data contracts — the exact table+columns each dashboard page reads.
// Guards against silent schema drift: a page that selects a missing table/column
// gets an error swallowed by `data || []` and renders permanently empty. Session
// 14 found four such pages (handbook/sops, expenses, stokvel ×2). `limit 0`
// resolves the query plan without returning rows, so a bad table/column errors.
console.log('\n[page data contracts]')
const contracts = [
  ['contacts',       'id, full_name, phone, email, company, contact_type, balance_owed, total_paid, sentiment_score, last_contacted_at'],
  ['invoices',       'id, contact_name, amount, amount_paid, days_overdue, status, recovery_tier, recovery_status'],
  ['products',       'id, name, sku, category, unit, current_stock, reorder_level, cost_price, unit_price'],
  ['contracts',      'id, title, contact_id, status, value, signed_at, created_at'],
  ['call_logs',      'id, direction, from_number, status, duration_sec, sentiment, summary, ai_handled, started_at'],
  ['broadcast_campaigns', 'id, name, status, message_body, sent_count, delivered_count, read_count, failed_count'],
  ['whatsapp_sequences',  'id, name, trigger_type, steps, is_active'],
  ['sop_documents',  'id, title, category, content, version, status, requires_acknowledgement'],
  ['kb_articles',    'id, category_id, title, content, tags, published, view_count'],
  ['expenses',       'id, staff_id, amount, category, description, receipt_url, status, submitted_at'],
  ['stokvel_groups', 'id, name, rules, contribution_amount, frequency, status'],
  ['stokvel_members','id, group_id, name, phone, payout_position, joined_at'],
  ['stokvel_contributions', 'group_id, member_id, amount, status, period_month, period_year'],
  ['cashflow_forecasts', 'generated_at, projected_inflows, risk_level'],
]
for (const [table, cols] of contracts) {
  const res = await sqlRaw(`select ${cols} from public.${table} limit 0;`)
  Array.isArray(res)
    ? ok(`page contract: ${table}`)
    : bad(`page contract: ${table} — ${res.message?.split('\n')[0] ?? 'error'}`)
}

// 7. API-route data contracts — tables/columns read or written by API routes.
// Session 14's sweep of app/api found five routes hitting non-existent tables
// (billing_events, campaign_sends, employment_equity, loyalty_accounts,
// task_comments); these assert the corrected targets. task_comments is
// intentionally absent (no table, no consumer — a dormant unbuilt feature).
console.log('\n[api-route data contracts]')
const apiContracts = [
  ['broadcast_recipients',    'tenant_id, campaign_id, contact_id, phone, status, sent_at, error_message'], // reach/send
  ['employment_equity_data',  'tenant_id, reporting_year, total_workforce, demographics'],                  // ee/report
  ['payment_events',          'tenant_id, event_type, amount, payfast_pf_id, m_payment_id, plan, payload'],  // billing/payfast-itn
  ['loyalty_points',          'tenant_id, contact_id, balance'],                                             // loyalty
  ['loyalty_programmes',      'tenant_id, name, point_value_zar, active'],                                   // loyalty
  ['contract_signatures',     'id, contract_id, signer_name, signer_email, signed_at, token, expires_at'],   // contracts/[id]/sign
  ['disciplinary_records',    'id, staff_id, record_type, incident_date, description, outcome, acknowledged_at'], // ir-log
  ['announcements',           'id, title, body, audience, pinned, published_at'],                            // announcements
  ['staff_documents',         'id, tenant_id, staff_id, title, file_url, file_type, expires_at'],            // staff/[id]/documents
  ['staff',                   'id, tenant_id, full_name, active, employment_type, gender, race, job_level'], // team + ee/report
]
for (const [table, cols] of apiContracts) {
  const res = await sqlRaw(`select ${cols} from public.${table} limit 0;`)
  Array.isArray(res)
    ? ok(`api contract: ${table}`)
    : bad(`api contract: ${table} — ${res.message?.split('\n')[0] ?? 'error'}`)
}
// task_comments now exists (migration 20260721) and the /api/tasks/[id]/comments
// route reads+writes it. Assert the table is present — absence would be a regression.
{
  const t = (await sql(`select to_regclass('public.task_comments') as t;`))[0]?.t
  t !== null
    ? ok('task_comments table exists (route live)')
    : bad('task_comments table missing — /api/tasks/[id]/comments would 400')
}

console.log(`\n== ${pass} passed, ${fail} failed, ${warn} warnings ==`)
process.exit(fail > 0 ? 1 : 0)
