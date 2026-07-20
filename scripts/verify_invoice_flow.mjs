// End-to-end: create an invoice via the real API → confirm it appears in the
// list API and the money export → clean up. Run against production, demo tenant.
//   node scripts/verify_invoice_flow.mjs
import fs from 'fs'

const env = Object.fromEntries(
  fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split(/\r?\n/).filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] }))

const U = env.NEXT_PUBLIC_SUPABASE_URL, A = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const MT = env.SUPABASE_ACCESS_TOKEN
const APP = 'https://www.adminos.co.za'
const REF = 'aetydnhnxmrsgqaqtofc'
const TEST_EMAIL = 'founder@adminos-demo.co.za', TEST_PW = 'AdminOS-Test-2026!'

let pass = 0, fail = 0
const ok = (m) => { pass++; console.log('  ✓', m) }
const bad = (m) => { fail++; console.log('  ✗ FAIL:', m) }

async function sql(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST', headers: { Authorization: `Bearer ${MT}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  const j = await r.json().catch(() => null)
  return Array.isArray(j) ? j : []
}

console.log('\n== Invoice create → list → export ==')

const t = await (await fetch(`${U}/auth/v1/token?grant_type=password`, {
  method: 'POST', headers: { apikey: A, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PW }),
})).json()
if (!t.access_token) { console.log('login failed', JSON.stringify(t)); process.exit(1) }
const claims = JSON.parse(Buffer.from(t.access_token.split('.')[1], 'base64').toString())
const TENANT = claims.app_metadata?.tenant_id
const session = { access_token: t.access_token, token_type: t.token_type, expires_in: t.expires_in, expires_at: t.expires_at, refresh_token: t.refresh_token, user: t.user }
const COOKIE = `sb-${REF}-auth-token=base64-${Buffer.from(JSON.stringify(session)).toString('base64url')}`
const auth = (path, init = {}) => fetch(APP + path, { ...init, headers: { cookie: COOKIE, 'content-type': 'application/json', ...(init.headers || {}) } })
console.log(`\n[auth] tenant ${TENANT?.slice(0,8)}…`)

// A distinctive amount so we can spot it in the export CSV: R137.00 + 15% = R157.55
const UNIT = 137.0, QTY = 1, VAT = 0.15
const expectedTotal = +(UNIT * QTY * (1 + VAT)).toFixed(2)  // 157.55
const MARKER = `E2E-TEST-${claims.exp}`

console.log('\n[create]')
const createRes = await auth('/api/invoices', {
  method: 'POST',
  body: JSON.stringify({ contactName: 'E2E Test Customer', lineItems: [{ description: MARKER, quantity: QTY, unitPrice: UNIT, vatRate: VAT }], reference: MARKER }),
})
const created = await createRes.json().catch(() => ({}))
createRes.status === 201 ? ok(`POST /api/invoices → 201 (id ${String(created.id).slice(0,8)}…)`) : bad(`POST returned ${createRes.status}: ${JSON.stringify(created)}`)
const invId = created.id
console.log(`  → returned row: amount=${created.amount}  total=${created.total}  amount_due=${created.amount_due}  status=${created.status}`)
created.total === expectedTotal ? ok(`total computed correctly (R${expectedTotal})`) : bad(`total = ${created.total}, expected ${expectedTotal}`)
created.amount === expectedTotal
  ? ok(`amount populated (R${created.amount}) — list/export will show the value`)
  : bad(`amount = ${created.amount} but the list & export READ 'amount' → invoice shows as R${created.amount ?? 0}, not R${expectedTotal}`)

console.log('\n[list]')
const listRes = await auth('/api/invoices')
const list = await listRes.json().catch(() => [])
const inList = Array.isArray(list) && list.find(i => i.id === invId)
inList ? ok('new invoice appears in GET /api/invoices') : bad('new invoice NOT in list')
if (inList) console.log(`  → as the table sees it: amount=${inList.amount}  days_overdue=${inList.days_overdue}  status=${inList.status}`)

console.log('\n[money export]')
const monthStamp = new Date(claims.iat * 1000).toISOString().slice(0, 7)
const expRes = await auth(`/api/money/export?type=journal`)
const csv = await expRes.text()
expRes.ok ? ok('GET /api/money/export?type=journal → 200') : bad(`export ${expRes.status}`)
const hasValue = csv.includes(String(expectedTotal)) || csv.includes(String(UNIT))
hasValue
  ? ok(`invoice value (R${expectedTotal}/R${UNIT}) present in journal export`)
  : bad(`invoice value R${expectedTotal} NOT found in journal export — export reads 'amount', which is ${created.amount ?? 'null'}`)

// ── Cleanup: hard-delete the test invoice (no DELETE API route exists) ────────
console.log('\n[cleanup]')
if (invId) {
  await sql(`delete from invoices where id = '${invId}' and tenant_id = '${TENANT}';`)
  const gone = (await sql(`select count(*)::int as n from invoices where id = '${invId}';`))[0]?.n === 0
  gone ? ok('test invoice deleted') : bad('cleanup failed — remove manually: ' + invId)
}

console.log(`\n== ${pass} passed, ${fail} failed ==`)
process.exit(fail ? 1 : 0)
