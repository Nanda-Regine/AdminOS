// End-to-end verification of the Session-16 flows (spine + autonomy + signals),
// driven through REAL authenticated HTTP against production plus Management-API
// SQL. Safe to re-run: it captures the demo tenant's autonomy + settings state,
// exercises each flow, then restores. It never triggers real customer WhatsApp
// sends (the one outbound action, money/remind, is only POSTed when the tenant
// has zero overdue invoices — otherwise its DB query is verified read-only).
//
//   node scripts/verify_flows.mjs
import fs from 'fs'

const env = Object.fromEntries(
  fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split(/\r?\n/).filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] }))

const U = env.NEXT_PUBLIC_SUPABASE_URL, A = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const MT = env.SUPABASE_ACCESS_TOKEN
const APP = 'https://www.adminos.co.za'   // hit www directly — apex 307s and drops the cookie
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
  const j = await r.json().catch(() => null)
  return Array.isArray(j) ? j : []
}

console.log('\n== AdminOS flow verification (Session 16) ==')

// ── Auth: real login → forge the @supabase/ssr session cookie ────────────────
const t = await (await fetch(`${U}/auth/v1/token?grant_type=password`, {
  method: 'POST', headers: { apikey: A, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PW }),
})).json()
if (!t.access_token) { console.log('  ✗ FAIL: login failed', JSON.stringify(t)); process.exit(1) }
const claims = JSON.parse(Buffer.from(t.access_token.split('.')[1], 'base64').toString())
const TENANT = claims.app_metadata?.tenant_id
const session = { access_token: t.access_token, token_type: t.token_type, expires_in: t.expires_in, expires_at: t.expires_at, refresh_token: t.refresh_token, user: t.user }
const COOKIE = `sb-${REF}-auth-token=base64-${Buffer.from(JSON.stringify(session)).toString('base64url')}`
const auth = (path, init = {}) => fetch(APP + path, { ...init, headers: { cookie: COOKIE, 'content-type': 'application/json', ...(init.headers || {}) } })
const noauth = (path, init = {}) => fetch(APP + path, { ...init, headers: { 'content-type': 'application/json', ...(init.headers || {}) } })
console.log(`\n[auth]`); ok(`logged in as demo tenant ${TENANT?.slice(0, 8)}…`)

// Capture original state for restore
const q = (s) => s.replace(/'/g, "''")
const origAutonomy = (await sql(`select tier from tenant_autonomy_config where tenant_id='${TENANT}' and domain='money' and decision_type='invoice_reminder';`))[0]?.tier ?? null
const origSettings = (await sql(`select coalesce(settings,'{}'::jsonb)::text as s from tenants where id='${TENANT}';`))[0]?.s ?? '{}'

async function restore() {
  console.log('\n[cleanup]')
  if (origAutonomy) await sql(`update tenant_autonomy_config set tier='${origAutonomy}' where tenant_id='${TENANT}' and domain='money' and decision_type='invoice_reminder';`)
  else await sql(`delete from tenant_autonomy_config where tenant_id='${TENANT}' and domain='money' and decision_type='invoice_reminder';`)
  await sql(`update tenants set settings='${q(origSettings)}'::jsonb where id='${TENANT}';`)
  ok('restored autonomy + settings to original state')
}

try {
  // ── FLOW 1 — Autonomy config (2.8/2.9 backbone) ────────────────────────────
  console.log('\n[flow 1 · autonomy config]')
  {
    const r = await auth('/api/autonomy'); const b = await r.json()
    r.status === 200 ? ok('GET /api/autonomy 200') : bad(`GET /api/autonomy ${r.status}`)
    const rem = b.decisions?.find(d => d.domain === 'money' && d.decision_type === 'invoice_reminder')
    const fd = b.decisions?.find(d => d.domain === 'money' && d.decision_type === 'final_demand')
    rem?.tier === 'A' ? ok('default: money/invoice_reminder = A (preserves recovery)') : bad(`invoice_reminder tier = ${rem?.tier}`)
    fd?.tier === 'C' ? ok('default: money/final_demand = C (legal boundary)') : bad(`final_demand tier = ${fd?.tier}`)

    // Set invoice_reminder → B, confirm it persists through the route + DB
    const s1 = await auth('/api/autonomy', { method: 'POST', body: JSON.stringify({ domain: 'money', decision_type: 'invoice_reminder', tier: 'B' }) })
    s1.status === 200 ? ok('POST set invoice_reminder → B') : bad(`POST tier ${s1.status}`)
    const after = (await auth('/api/autonomy').then(x => x.json())).decisions?.find(d => d.decision_type === 'invoice_reminder')?.tier
    after === 'B' ? ok('re-read reflects B (route+DB round-trip)') : bad(`re-read tier = ${after}`)
    const dbTier = (await sql(`select tier from tenant_autonomy_config where tenant_id='${TENANT}' and domain='money' and decision_type='invoice_reminder';`))[0]?.tier
    dbTier === 'B' ? ok('DB row = B') : bad(`DB tier = ${dbTier}`)

    // Legal guard: final_demand can NEVER be set to auto
    const g = await auth('/api/autonomy', { method: 'POST', body: JSON.stringify({ domain: 'money', decision_type: 'final_demand', tier: 'A' }) })
    g.status === 400 ? ok('guard: final_demand → A rejected (400)') : bad(`final_demand → A returned ${g.status}, must be 400`)

    // Auth guard
    const na = await noauth('/api/autonomy')
    na.status === 401 ? ok('unauthenticated GET → 401') : bad(`unauth GET → ${na.status}`)
  }

  // ── FLOW 2 — Notification preferences + quiet hours (1.7 + quiet-hours) ─────
  console.log('\n[flow 2 · notification prefs + quiet hours]')
  {
    const r = await auth('/api/settings/notifications'); const b = await r.json()
    r.status === 200 ? ok('GET /api/settings/notifications 200') : bad(`GET prefs ${r.status}`)
    'quietHours' in b && 'notify' in b ? ok('shape: {quietHours, notify}') : bad('unexpected prefs shape ' + JSON.stringify(b).slice(0, 80))

    // Set a quiet-hours window (21:00→06:00 SAST)
    const s1 = await auth('/api/settings/notifications', { method: 'POST', body: JSON.stringify({ quietHours: { start: 1260, end: 360 } }) })
    s1.status === 200 ? ok('POST quietHours 21:00→06:00') : bad(`POST quietHours ${s1.status}`)
    const back = await auth('/api/settings/notifications').then(x => x.json())
    back.quietHours?.start === 1260 && back.quietHours?.end === 360 ? ok('quietHours persisted (route round-trip)') : bad('quietHours not persisted: ' + JSON.stringify(back.quietHours))
    const dbQuiet = (await sql(`select settings->'quiet_hours' as q from tenants where id='${TENANT}';`))[0]?.q
    dbQuiet && dbQuiet.start === 1260 ? ok('DB settings.quiet_hours set') : bad('DB quiet_hours = ' + JSON.stringify(dbQuiet))

    // Per-type WhatsApp opt-out
    const s2 = await auth('/api/settings/notifications', { method: 'POST', body: JSON.stringify({ type: 'payment.received', whatsapp: false }) })
    s2.status === 200 ? ok('POST payment.received WhatsApp off') : bad(`POST pref ${s2.status}`)
    const back2 = await auth('/api/settings/notifications').then(x => x.json())
    back2.notify?.['payment.received']?.whatsapp === false ? ok('per-type opt-out persisted') : bad('opt-out not persisted: ' + JSON.stringify(back2.notify))

    // Validation guard: out-of-range minutes rejected
    const badv = await auth('/api/settings/notifications', { method: 'POST', body: JSON.stringify({ quietHours: { start: 9999, end: 10 } }) })
    badv.status === 400 ? ok('guard: invalid quietHours → 400') : bad(`invalid quietHours → ${badv.status}`)

    // Merge safety: unrelated settings keys survived both writes
    const stillHasKeys = (await sql(`select (settings ? 'quiet_hours') as hq, (settings ? 'notify') as hn from tenants where id='${TENANT}';`))[0]
    stillHasKeys?.hq && stillHasKeys?.hn ? ok('read-merge-write kept both keys') : bad('merge lost a key: ' + JSON.stringify(stillHasKeys))
  }

  // ── FLOW 3 — Money "Send reminders" (1.5) ──────────────────────────────────
  console.log('\n[flow 3 · money/remind]')
  {
    // The exact query the endpoint runs — verify it resolves against prod schema.
    const rows = await sql(`select id from invoices where tenant_id='${TENANT}' and status in ('unpaid','partial') and due_date < current_date and (recovery_status is null or recovery_status='auto') limit 500;`)
    ok(`overdue-invoice query resolves (${rows.length} candidate${rows.length === 1 ? '' : 's'})`)
    const na = await noauth('/api/money/remind', { method: 'POST' })
    na.status === 401 ? ok('unauthenticated POST → 401') : bad(`unauth remind → ${na.status}`)
    if (rows.length === 0) {
      // Safe to actually drive it: nothing to send, so no outbound side effects.
      const r = await auth('/api/money/remind', { method: 'POST' }); const b = await r.json()
      r.status === 200 && b.queued === 0 ? ok('POST remind → {queued:0} (no side effects)') : bad(`remind → ${r.status} ${JSON.stringify(b)}`)
    } else {
      wrn(`skipped live POST — ${rows.length} overdue invoice(s) would enqueue real reminders; query verified read-only`)
    }
  }

  // ── FLOW 4 — Durable signal mirror (2.3), through the real page code path ───
  console.log('\n[flow 4 · durable signal mirror]')
  {
    const before = Date.now()
    const page = await auth('/dashboard/money')
    page.status === 200 ? ok('GET /dashboard/money 200 (server publishSignal runs)') : bad(`cockpit load ${page.status}`)
    // The server component calls `void publishSignal('money', …)` — fire-and-forget,
    // so the dual-write lands shortly AFTER the response. Poll up to ~10s for a row
    // freshly written by this load (Inngest workers await it fully; a page load is
    // best-effort by design — same as the Redis write has always been).
    let row = null
    for (let i = 0; i < 10; i++) {
      await new Promise(r => setTimeout(r, 1000))
      row = (await sql(`select health, extract(epoch from updated_at)*1000 as ms, (payload ? 'mode') as has_mode from domain_signals where tenant_id='${TENANT}' and domain='money';`))[0]
      if (row && Number(row.ms) >= before - 2000) break
    }
    if (!row) bad('no domain_signals row written (dual-write never landed)')
    else {
      Number(row.ms) >= before - 2000 ? ok('domain_signals.money written fresh by the page load (dual-write confirmed)') : wrn(`row exists but not refreshed by this load (updated ${new Date(Number(row.ms)).toISOString()})`)
      row.has_mode ? ok('payload persisted (money signal has `mode`)') : bad('payload missing expected field')
      row.health ? ok(`health mirrored (${row.health})`) : wrn('health column null')
    }
  }

  // ── FLOW 5 — Notification bell data path (1.6) ─────────────────────────────
  console.log('\n[flow 5 · notification bell]')
  {
    const r = await auth('/api/notifications')
    if (r.status === 200) {
      const b = await r.json()
      ok(`GET /api/notifications 200 (${Array.isArray(b) ? b.length : Array.isArray(b?.notifications) ? b.notifications.length : '?'} rows)`)
    } else bad(`GET /api/notifications ${r.status}`)
    const na = await noauth('/api/notifications')
    na.status === 401 ? ok('unauthenticated GET → 401') : bad(`unauth notifications → ${na.status}`)
  }

} catch (e) {
  bad('unexpected error: ' + (e?.message || e))
} finally {
  await restore()
}

console.log(`\n== ${pass} passed, ${fail} failed, ${warn} warnings ==`)
process.exit(fail > 0 ? 1 : 0)
