// Authorization matrix test against prod (Workstream D, BUILD_JOURNEY Session 20).
//
// Signs in as every QA persona login (7 personas + the owners created beside
// them, scripts/qa-personas.mjs) and, for each one:
//
//   1. API routes on withRoute: every exported method is called and the result
//      compared with the role matrix (lib/auth/roleMatrix.ts). Forbidden → must
//      be 403. Allowed → must not be 401/403 (5xx is recorded as broken).
//      Never mutates: a forbidden call stops at the role check; an allowed write
//      is only sent with an unparseable body (withRoute rejects it with 400
//      before the handler runs) or against a random id. Allowed writes with no
//      body schema and no id are listed as "not probed".
//   2. API routes NOT on withRoute: GET only, status recorded per role, and any
//      2xx for an own-data role (staff/field_agent/client) is flagged for review.
//   3. Dashboard pages in the nav: 200 expected when the nav would show the
//      page for that role (lib/nav/features.ts `requires`), otherwise 404/redirect.
//   4. Cross-tenant: GET /api/<thing>/<id> with ids from OTHER tenants must
//      never return the row (2xx = leak).
//
//   node scripts/authz-matrix.mjs [baseUrl] [--only salon,clinic] [--routes]
//
// Output: scripts/audit-out/authz-matrix.json + a summary on stdout.
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { ACTIONS, DEFAULT_ROLE_PERMISSIONS, MEMBER } from '../lib/auth/roleMatrix.ts'
import { PERSONAS } from './qa-personas.mjs'
import { signIn, cookieHeader, select } from './lib/qa.mjs'

const args = process.argv.slice(2)
const BASE = args.find(a => a.startsWith('http')) ?? 'https://www.adminos.co.za'
const ONLY = args.includes('--only') ? args[args.indexOf('--only') + 1].split(',') : null
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '..')

// ── Route discovery ─────────────────────────────────────────────────────────
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (e.name === 'route.ts') out.push(p)
  }
  return out
}

function discoverRoutes() {
  const routes = []
  for (const file of walk(path.join(ROOT, 'app', 'api'))) {
    const rel = path.relative(path.join(ROOT, 'app'), path.dirname(file)).split(path.sep).filter(s => !/^\(.*\)$/.test(s))
    const urlPath = '/' + rel.join('/')
    const src = fs.readFileSync(file, 'utf8')
    // Lookahead, not a consuming capture: a short file's next export would
    // otherwise be swallowed by the previous method's window and skipped.
    for (const m of src.matchAll(/export\s+(?:const|async function)\s+(GET|POST|PATCH|PUT|DELETE)\b(?=([\s\S]{0,1200}))/g)) {
      const [, method, window] = m
      const after = window.split(/\nexport /)[0] // this method only
      const wr = /^\s*=\s*withRoute\(\s*\{([\s\S]*?)\}\s*,\s*async/.exec(after)
      // Legacy routes call guard('action') at the top of the method (lib/api/guard.ts).
      const guarded = !wr && /const gate = await guard\('([a-z_.]+)'\)/.exec(after.slice(0, 600))?.[1]
      const action = (wr && /action:\s*'([a-z_.]+)'/.exec(wr[1])?.[1]) || guarded
      routes.push({
        method, path: urlPath, file: path.relative(ROOT, file).replace(/\\/g, '/'),
        withRoute: Boolean(wr), guarded: Boolean(guarded), action: action ?? null,
        hasBody: Boolean(wr && /\bbody:/.test(wr[1])), hasQuery: Boolean(wr && /\bquery:/.test(wr[1])),
        dynamic: /\[[^\]]+\]/.test(urlPath),
      })
    }
  }
  return routes.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method))
}

// Public / machine routes: authenticated by signature, token or cron secret, not a session.
const PUBLIC = [/^\/api\/(webhook|webhooks|inngest|cron|book|widget|sign|payslip|public|health|auth|workflow|n8n|og|status|unsubscribe|portal|track|pay|payments|onboarding|payslips\/view|paystack|voice|billing\/payfast-itn|billing\/webhook)\b/]
const isPublic = (p) => PUBLIC.some(re => re.test(p))

// ── Nav pages (parsed from lib/nav/features.ts; it imports icons, so no import) ─
function navPages() {
  const src = fs.readFileSync(path.join(ROOT, 'lib', 'nav', 'features.ts'), 'utf8')
  const out = []
  for (const m of src.matchAll(/\{\s*href:\s*'([^']+)'[^\n]*\n?/g)) {
    const line = m[0]
    const req = /requires:\s*(\[[^\]]*\]|'[^']+')/.exec(line)?.[1]
    const requires = req ? (req.startsWith('[') ? [...req.matchAll(/'([^']+)'/g)].map(x => x[1]) : [req.slice(1, -1)]) : []
    const industries = /industries:\s*\[([^\]]*)\]/.exec(line)?.[1]
    out.push({ href: m[1], requires, industries: industries ? [...industries.matchAll(/'([^']+)'/g)].map(x => x[1]) : null })
  }
  return out
}

// ── Expectations ────────────────────────────────────────────────────────────
const allowed = (role, action) => {
  const need = ACTIONS[action]
  return need === MEMBER || DEFAULT_ROLE_PERMISSIONS[role].includes(need)
}
const canOpen = (role, page) => !page.requires.length || page.requires.some(p => DEFAULT_ROLE_PERMISSIONS[role].includes(p))

// ── HTTP ────────────────────────────────────────────────────────────────────
async function call(cookie, method, url, body) {
  const init = { method, redirect: 'manual', headers: { cookie, accept: 'application/json', origin: BASE } }
  if (body !== undefined) { init.body = body; init.headers['content-type'] = 'application/json' }
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(BASE + url, init)
      const text = await r.text()
      // notFound() after streaming has started (dashboard has loading.tsx) still answers 200, so look for the 404 UI.
      const notFound = r.status === 404 || text.includes('NEXT_HTTP_ERROR_FALLBACK;404') || text.includes('404 — Page Not Found')
      return { status: r.status, notFound, location: r.headers.get('location'), text: text.slice(0, 400) }
    } catch (e) {
      if (attempt === 2) return { status: 0, text: String(e).slice(0, 200) }
    }
  }
}

async function pool(items, n, fn) {
  const out = new Array(items.length)
  let i = 0
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]) } }))
  return out
}

const fakeId = () => crypto.randomUUID()
const fill = (p, id) => p.replace(/\[[^\]]+\]/g, () => id ?? fakeId())

// ── Main ────────────────────────────────────────────────────────────────────
const routes = discoverRoutes()
if (args.includes('--routes')) {
  for (const r of routes) console.log(`${r.method.padEnd(6)} ${r.path.padEnd(48)} ${r.action ? (r.guarded ? 'guard:' : '') + r.action : r.withRoute ? '(withRoute, action?)' : isPublic(r.path) ? 'public' : 'UNGUARDED?'}`)
  process.exit(0)
}

const logins = []
for (const p of PERSONAS) {
  if (ONLY && !ONLY.includes(p.key)) continue
  logins.push({ persona: p.key, role: p.persona.role, email: `nandaregine+persona-${p.key}@gmail.com`, business_type: p.business_type })
  if (p.persona.role !== 'owner') logins.push({ persona: p.key, role: 'owner', email: `nandaregine+persona-${p.key}-owner@gmail.com`, business_type: p.business_type })
}

const tenants = await select('tenants', `select=id,slug&slug=like.qa-persona-*`)
const tenantOf = (key) => tenants.find(t => t.slug === `qa-persona-${key}`)?.id
const [mzansi] = await select('tenants', 'select=id&slug=eq.mzansi-test-traders')

// Real ids from other tenants, for the cross-tenant probe.
const XT_TABLES = { invoices: 'invoices', contacts: 'contacts', staff: 'staff', tasks: 'tasks', expenses: 'expenses', suppliers: 'suppliers', products: 'products', inventory: 'products', bookings: 'bookings', documents: 'documents', announcements: 'announcements', leave: 'leave_requests', shifts: 'shifts', payroll: 'payroll_runs', contracts: 'contracts', 'email-drafts': 'email_drafts', quotes: 'quotes', projects: 'projects' }
async function foreignId(table, notTenant) {
  const rows = await select(table, `select=id,tenant_id&tenant_id=neq.${notTenant}&deleted_at=is.null&limit=1`).catch(() => select(table, `select=id,tenant_id&tenant_id=neq.${notTenant}&limit=1`).catch(() => []))
  return rows[0]?.id
}

const pages = navPages()
const OUT = path.join(ROOT, 'scripts', 'audit-out', ONLY ? `authz-matrix-${ONLY.join('-')}.json` : 'authz-matrix.json')
fs.mkdirSync(path.dirname(OUT), { recursive: true })
const save = () => fs.writeFileSync(OUT, JSON.stringify(report, null, 2))
const report = { base: BASE, at: new Date().toISOString(), logins: [] }
const summary = []

for (const login of logins) {
  let cookie
  try { cookie = cookieHeader(await signIn(login.email)) } catch (e) { console.log(`✗ ${login.email}: ${e.message}`); continue }
  const T = tenantOf(login.persona)
  const sanity = await call(cookie, 'GET', '/api/notifications')
  const entry = { ...login, tenantId: T, sanity: sanity.status, api: [], unguarded: [], pages: [], crossTenant: [], notProbed: [] }

  // 1 + 2. API
  const jobs = []
  for (const r of routes) {
    if (isPublic(r.path)) continue
    if ((r.withRoute || r.guarded) && r.action) {
      const expect = allowed(login.role, r.action)
      if (r.method === 'GET') jobs.push({ r, expect, url: fill(r.path) })
      else if (!expect) jobs.push({ r, expect, url: fill(r.path), body: '{}' })
      else if (r.guarded) entry.notProbed.push(`${r.method} ${r.path}`) // legacy body handling: never send an allowed write
      else if (r.hasBody) jobs.push({ r, expect, url: fill(r.path), body: 'not-json' })
      else if (r.dynamic) jobs.push({ r, expect, url: fill(r.path), body: 'not-json' })
      else entry.notProbed.push(`${r.method} ${r.path}`)
    } else if (r.method === 'GET') {
      jobs.push({ r, expect: null, url: fill(r.path) })
    }
  }
  await pool(jobs, 6, async (j) => {
    const res = await call(cookie, j.r.method, j.url, j.body)
    if (j.expect === null) {
      entry.unguarded.push({ route: `GET ${j.r.path}`, status: res.status })
      return
    }
    let verdict
    if (res.status === 429) verdict = 'rate_limited'
    else if (j.expect) verdict = res.status === 401 || res.status === 403 ? 'WRONGLY_DENIED' : res.status >= 500 || res.status === 0 ? 'BROKEN' : 'ok'
    else verdict = res.status === 403 ? 'ok' : res.status >= 200 && res.status < 300 ? 'LEAK' : 'WRONG_STATUS'
    entry.api.push({ route: `${j.r.method} ${j.r.path}`, action: j.r.action, expect: j.expect ? 'allow' : 'deny', status: res.status, verdict, ...(verdict !== 'ok' ? { body: res.text.slice(0, 160) } : {}) })
  })

  // 3. Pages
  await pool(pages, 4, async (pg) => {
    const res = await call(cookie, 'GET', pg.href)
    const inIndustry = !pg.industries || pg.industries.includes(login.business_type)
    const expect = canOpen(login.role, pg)
    const opened = res.status === 200 && !res.notFound
    const verdict = res.status >= 500 || res.status === 0 ? 'BROKEN' : expect === opened ? 'ok' : expect ? 'WRONGLY_DENIED' : 'LEAK'
    entry.pages.push({ href: pg.href, expect: expect ? 'open' : 'blocked', inIndustry, status: res.notFound ? '404ui' : res.status, location: res.location, verdict })
  })

  // 4. Cross-tenant: only routes that exist as GET /api/<seg>/[id]
  for (const r of routes.filter(r => r.method === 'GET' && /^\/api\/[^/]+\/\[[^\]]+\]$/.test(r.path))) {
    const seg = r.path.split('/')[2]
    const table = XT_TABLES[seg]
    if (!table) continue
    const id = await foreignId(table, T)
    if (!id) { entry.crossTenant.push({ route: r.path, verdict: 'no foreign row to probe' }); continue }
    const res = await call(cookie, 'GET', fill(r.path, id))
    entry.crossTenant.push({ route: r.path, table, status: res.status, verdict: res.status >= 200 && res.status < 300 ? 'LEAK' : 'ok', ...(res.status < 300 ? { body: res.text.slice(0, 160) } : {}) })
  }

  report.logins.push(entry)
  save()
  const bad = (xs) => xs.filter(x => x.verdict && !['ok', 'no foreign row to probe', 'rate_limited'].includes(x.verdict))
  const ownDataRole = ['staff', 'field_agent', 'client'].includes(login.role)
  const flagged = ownDataRole ? entry.unguarded.filter(u => u.status >= 200 && u.status < 300) : []
  summary.push({
    login: `${login.persona}/${login.role}`, sanity: sanity.status,
    api: `${entry.api.filter(x => x.verdict === 'ok').length}/${entry.api.length}`, apiBad: bad(entry.api).length,
    pages: `${entry.pages.filter(x => x.verdict === 'ok').length}/${entry.pages.length}`, pagesBad: bad(entry.pages).length,
    xTenantLeaks: entry.crossTenant.filter(x => x.verdict === 'LEAK').length, unguarded2xx: flagged.length,
  })
  console.log(`${login.persona}/${login.role}: done`)
}

console.table(summary)
for (const e of report.logins) {
  const bad = [...e.api, ...e.pages, ...e.crossTenant].filter(x => x.verdict && !['ok', 'no foreign row to probe', 'rate_limited'].includes(x.verdict))
  if (bad.length) {
    console.log(`\n── ${e.persona}/${e.role}`)
    for (const b of bad) console.log(`  ${b.verdict.padEnd(15)} ${String(b.status).padEnd(4)} ${b.route ?? b.href}${b.action ? `  (${b.action})` : ''}${b.body ? `  ${b.body.replace(/\s+/g, ' ').slice(0, 100)}` : ''}${b.location ? ` → ${b.location}` : ''}`)
  }
}
