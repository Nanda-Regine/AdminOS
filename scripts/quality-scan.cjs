// Quality scan: heuristic signals per API route + dashboard page (permission
// checks, input validation, hard deletes, raw DB error leaks, empty states,
// unbounded queries). Heuristic - verify before acting. Run: node scripts/quality-scan.cjs
//   --check            exit 1 if any score is worse than scripts/quality-baseline.json (CI)
//   --write-baseline   record current scores as the new baseline (after an improvement)
// Baseline 2026-10-04: see BUILD_JOURNEY_ADMINOS.md Session 16.
const fs = require('fs'), path = require('path')
const root = path.resolve(__dirname, '..').replace(/\\/g, '/')
function walk(d, name, o = []) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f)
    fs.statSync(p).isDirectory() ? walk(p, name, o) : f === name && o.push(p)
  }
  return o
}
const rel = (f) => f.replace(/\\/g, '/').replace(root + '/', '')

// â”€â”€ API routes
const routes = walk(root + '/app/api', 'route.ts').map((f) => {
  const s = fs.readFileSync(f, 'utf8')
  const methods = (s.match(/export (?:async function|const) (GET|POST|PUT|PATCH|DELETE)\b/g) || []).map((m) => m.split(' ').pop())
  // withRoute({ action, body, audit, rateLimit }) declares these in its config.
  const cfg = (s.match(/withRoute\(\{[\s\S]*?\}\s*,\s*async/g) || []).join('\n')
  return {
    f: rel(f).replace('app/api/', ''),
    writes: methods.some((m) => m !== 'GET'),
    wrapped: /withRoute\(/.test(s),
    // Every exported method needs its own check. Counting the file as checked
    // when any method was let open GETs hide behind guarded POSTs (Session 20:
    // ~80 methods across 51 routes).
    perm: s.split(/(?=export (?:async function|const) (?:GET|POST|PUT|PATCH|DELETE)\b)/).slice(1)
      .every((m) => /requirePermission|checkPermission|requireSuperAdmin|withRoute\(|\bguard\(|can\(ctx|ctx\.require\(/.test(m)),
    zod: /z\.object|safeParse|\.parse\(/.test(s) || /\bbody:/.test(cfg),
    hardDel: /\.delete\(\)/.test(s),
    selStar: /select\('\*'/.test(s),
    leak: /NextResponse\.json\(\s*\{\s*error:\s*(error|err|e)\.message/.test(s),
    audit: /writeAuditLog|\baudit\(\{/.test(s) || /\baudit:/.test(cfg),
    rl: /checkRateLimit/.test(s) || /\brateLimit:/.test(cfg),
    pub: /^(webhook|book|widget|voice|billing\/webhook|billing\/payfast-itn|paystack\/webhook|health|auth|onboarding|payslips\/view)/.test(rel(f).replace('app/api/', '')),
  }
})
const c = (a, k) => a.filter((r) => r[k]).length
const list = (a) => a.map((r) => r.f.replace('/route.ts', '')).join(', ')
console.log('API ROUTES', routes.length, '| with writes', c(routes, 'writes'))
const noPerm = routes.filter((r) => !r.perm && !r.pub)
console.log('\nno role/permission check (non-public):', noPerm.length, '\n ', list(noPerm))
const noZod = routes.filter((r) => r.writes && !r.zod && !r.pub)
console.log('\nwrite routes with no schema validation:', noZod.length, '\n ', list(noZod))
console.log('\nhard .delete() (Rule #3):', c(routes, 'hardDel'), '\n ', list(routes.filter((r) => r.hardDel)))
console.log('\nreturns raw DB error text to client:', c(routes, 'leak'), '\n ', list(routes.filter((r) => r.leak)))
console.log('\nselect(*):', c(routes, 'selStar'))
console.log('write routes w/o audit log:', routes.filter((r) => r.writes && !r.audit).length)
console.log('rate limited:', c(routes, 'rl'))

// â”€â”€ Dashboard pages
const PAGE_PERM = /requirePermission|checkPermission|getUserPermissions|\bcan\(ctx,|seesOnlyOwnData\(/
// A segment layout.tsx gate (used for client-component pages) covers every page under it.
function layoutGated(f) {
  for (let d = path.dirname(f); d.replace(/\\/g, '/').startsWith(root + '/app/dashboard/'); d = path.dirname(d)) {
    const l = path.join(d, 'layout.tsx')
    if (fs.existsSync(l) && PAGE_PERM.test(fs.readFileSync(l, 'utf8'))) return true
  }
  return false
}
const pages = walk(root + '/app/dashboard', 'page.tsx').map((f) => {
  const s = fs.readFileSync(f, 'utf8')
  return {
    f: rel(f).replace('app/dashboard/', '').replace('/page.tsx', '').replace('page.tsx', '(root)'),
    lines: s.split('\n').length,
    client: /^['"]use client['"]/m.test(s),
    perm: PAGE_PERM.test(s) || layoutGated(f), // can()/seesOnlyOwnData = role-scoped rendering; a segment layout gate counts too
    empty: /No .* yet|empty|EmptyState|nothing/i.test(s),
    anyCount: (s.match(/: any\b|as any\b/g) || []).length,
    alert: /\balert\(|confirm\(/.test(s),
    unbounded: /\.from\('[a-z_]+'\)[\s\S]{0,200}?\.select\([^)]*\)(?![\s\S]{0,300}?(\.limit|\.range|\.single|\.maybeSingle|count:))/.test(s),
  }
})
console.log('\n\nDASHBOARD PAGES', pages.length)
console.log('client components:', c(pages, 'client'))
console.log('no permission check:', pages.filter((p) => !p.perm).length, '\n ', pages.filter((p) => !p.perm).map((p) => p.f).join(', '))
console.log('\nno empty state detected:', pages.filter((p) => !p.empty).length, '\n ', pages.filter((p) => !p.empty).map((p) => p.f).join(', '))
console.log('\nuses browser alert()/confirm():', c(pages, 'alert'), '\n ', pages.filter((p) => p.alert).map((p) => p.f).join(', '))
console.log('\npossibly unbounded list query:', c(pages, 'unbounded'), '\n ', pages.filter((p) => p.unbounded).map((p) => p.f).join(', '))
console.log('\n`any` usages total:', pages.reduce((a, p) => a + p.anyCount, 0))
console.log('\nlargest pages (lines):', pages.sort((a, b) => b.lines - a.lines).slice(0, 10).map((p) => `${p.f}:${p.lines}`).join(', '))

// ── Scores + ratchet. Lower is better unless in HIGHER_IS_BETTER.
// ── Money reads that can be silently truncated
// PostgREST returns at most 1000 rows. A select on a money table that is summed
// in code must page (allRows/fetchAll) or be bounded (.limit/.range/.single).
// Every Quick Sale is an invoice row, so a busy shop passes 1000 in weeks.
const MONEY_TABLES = ['invoices', 'expenses', 'payslips', 'payroll_runs', 'stokvel_contributions', 'loyalty_points']
function walkCode(d, o = []) {
  for (const x of fs.readdirSync(d)) {
    const p = path.join(d, x)
    if (x === 'node_modules' || x.startsWith('.')) continue
    fs.statSync(p).isDirectory() ? walkCode(p, o) : /\.(ts|tsx)$/.test(x) && o.push(p)
  }
  return o
}
const moneyUnpaged = []
for (const f of ['app', 'lib', 'inngest'].flatMap((d) => walkCode(path.join(root, d)))) {
  const src = fs.readFileSync(f, 'utf8')
  for (const m of src.matchAll(/\.from\('([a-z_]+)'\)/g)) {
    if (!MONEY_TABLES.includes(m[1])) continue
    const stmt = src.slice(m.index, m.index + 420).split(/\n\s*\n|\n\s*(?:const|let|if|return|await)\b|\n\s*supabaseAdmin|\n\s*ctx\.db|\n\s*supabase\b/)[0]
    if (!/\.select\(/.test(stmt)) continue
    if (/\.(limit|range|single|maybeSingle)\(|head: true|\.eq\('id'|\.in\('id'|fetchAll|allRows/.test(stmt)) continue
    if (/\.(update|insert|delete|upsert)\(/.test(stmt.split('.select(')[0])) continue
    moneyUnpaged.push(rel(f) + ':' + src.slice(0, m.index).split('\n').length)
  }
}
console.log('\nmoney-table selects not paged/bounded (reviewed ones are bounded by filters):', moneyUnpaged.length, '\n ', moneyUnpaged.join(', '))

const metrics = {
  routes_no_permission: noPerm.length,
  write_routes_no_zod: noZod.length,
  routes_hard_delete: c(routes, 'hardDel'),
  routes_leak_db_error: c(routes, 'leak'),
  routes_select_star: c(routes, 'selStar'),
  write_routes_no_audit: routes.filter((r) => r.writes && !r.audit).length,
  routes_rate_limited: c(routes, 'rl'),
  routes_on_withRoute: c(routes, 'wrapped'),
  pages_no_permission: pages.filter((p) => !p.perm).length,
  pages_no_empty_state: pages.filter((p) => !p.empty).length,
  pages_unbounded_query: c(pages, 'unbounded'),
  money_reads_unpaged: moneyUnpaged.length,
}
const HIGHER_IS_BETTER = new Set(['routes_rate_limited', 'routes_on_withRoute'])
const baselinePath = path.join(__dirname, 'quality-baseline.json')
console.log('\n\nSCORES', JSON.stringify(metrics, null, 2))

if (process.argv.includes('--write-baseline')) {
  fs.writeFileSync(baselinePath, JSON.stringify(metrics, null, 2) + '\n')
  console.log('baseline written:', rel(baselinePath))
} else if (process.argv.includes('--check')) {
  const base = JSON.parse(fs.readFileSync(baselinePath, 'utf8'))
  const cmp = (k, v) => (HIGHER_IS_BETTER.has(k) ? base[k] - v : v - base[k])
  const entries = Object.entries(metrics).filter(([k]) => base[k] !== undefined)
  for (const [k, v] of entries.filter(([k, v]) => cmp(k, v) < 0)) {
    console.log(`improved: ${k} ${base[k]} -> ${v} (run --write-baseline to lock it in)`)
  }
  const worse = entries.filter(([k, v]) => cmp(k, v) > 0)
  if (worse.length) {
    for (const [k, v] of worse) console.error(`REGRESSION: ${k} ${base[k]} -> ${v}`)
    console.error('\nQuality ratchet failed. Fix the new route/page, or if the change is intentional,')
    console.error('update scripts/quality-baseline.json in the same commit and say why in the message.')
    process.exit(1)
  }
  console.log('quality ratchet: no regressions')
}

