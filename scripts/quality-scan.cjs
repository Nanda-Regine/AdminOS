// Quality scan: heuristic signals per API route + dashboard page (permission
// checks, input validation, hard deletes, raw DB error leaks, empty states,
// unbounded queries). Heuristic - verify before acting. Run: node scripts/quality-scan.cjs
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
  const methods = (s.match(/export async function (GET|POST|PUT|PATCH|DELETE)/g) || []).map((m) => m.split(' ').pop())
  return {
    f: rel(f).replace('app/api/', ''),
    writes: methods.some((m) => m !== 'GET'),
    perm: /requirePermission|checkPermission|requireSuperAdmin/.test(s),
    zod: /z\.object|safeParse|\.parse\(/.test(s),
    hardDel: /\.delete\(\)/.test(s),
    selStar: /select\('\*'/.test(s),
    leak: /NextResponse\.json\(\s*\{\s*error:\s*(error|err|e)\.message/.test(s),
    audit: /writeAuditLog/.test(s),
    rl: /checkRateLimit/.test(s),
    pub: /^(webhook|book|widget|voice|billing\/webhook|billing\/payfast-itn|paystack\/webhook|health|auth|onboarding)/.test(rel(f).replace('app/api/', '')),
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
const pages = walk(root + '/app/dashboard', 'page.tsx').map((f) => {
  const s = fs.readFileSync(f, 'utf8')
  return {
    f: rel(f).replace('app/dashboard/', '').replace('/page.tsx', '').replace('page.tsx', '(root)'),
    lines: s.split('\n').length,
    client: /^['"]use client['"]/m.test(s),
    perm: /requirePermission|checkPermission|getUserPermissions/.test(s),
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

