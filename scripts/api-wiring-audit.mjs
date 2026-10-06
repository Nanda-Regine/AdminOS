// API wiring audit (Session 20) — is every /api call connected to a real route,
// and is every route connected to something?
//
//   1. Callers: fetch()/api.get|post|patch|put|delete() in pages, components,
//      lib and the Expo app; <form action="/api/..">; href/src="/api/..".
//      The URL is read from string or template literals (`${x}` → any segment).
//   2. Routes: app/api/**/route.ts and the HTTP methods each one exports.
//   3. Report: calls to routes that don't exist, calls with a method the route
//      doesn't export, and routes nothing in the codebase calls (orphans),
//      pre-classified so a human can decide: external (webhook/cron/inngest/
//      public link), or "NO UI" — built server-side but never wired to a screen.
//
//   node scripts/api-wiring-audit.mjs [--json]

import fs from 'fs'
import path from 'path'
import ts from 'typescript'

function walk(d, out = []) {
  if (!fs.existsSync(d)) return out
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name)
    if (e.isDirectory()) { if (!['node_modules', '.next', '.expo'].includes(e.name)) walk(p, out) }
    else if (/\.(ts|tsx)$/.test(e.name) && !e.name.endsWith('.d.ts')) out.push(p)
  }
  return out
}
const norm = p => p.replace(/\\/g, '/')

// ── Routes ──────────────────────────────────────────────────────────────────
const routes = []
for (const f of walk('app/api').filter(f => /route\.ts$/.test(f))) {
  const src = fs.readFileSync(f, 'utf8')
  const methods = new Set()
  for (const m of src.matchAll(/export\s+(?:async\s+function|const|function)\s+(GET|POST|PUT|PATCH|DELETE)\b/g)) methods.add(m[1])
  for (const m of src.matchAll(/export\s*\{([^}]*)\}/g)) for (const x of m[1].split(',')) { const n = x.trim().split(/\s+as\s+/).pop(); if (/^(GET|POST|PUT|PATCH|DELETE)$/.test(n)) methods.add(n) }
  const url = '/' + norm(path.dirname(f)).replace(/^app\//, '')
  const segs = url.split('/').filter(Boolean)
  routes.push({ file: norm(f), url, segs, methods, callers: [] })
}

function matchRoute(urlSegs) {
  // Prefer the most literal match (fewest dynamic segments).
  let best = null, bestScore = -1
  for (const r of routes) {
    if (r.segs.length !== urlSegs.length) continue
    let score = 0, ok = true
    for (let i = 0; i < r.segs.length; i++) {
      const rs = r.segs[i], us = urlSegs[i]
      if (rs.startsWith('[')) continue
      if (us === '*') { ok = false; break } // dynamic caller segment vs literal route segment: can't be sure → no
      if (rs !== us) { ok = false; break }
      score++
    }
    if (ok && score > bestScore) { best = r; bestScore = score }
  }
  // A dynamic caller segment may still hit a literal route (e.g. `${base}/export`) —
  // second pass treating '*' as wildcard.
  if (!best) for (const r of routes) {
    if (r.segs.length !== urlSegs.length) continue
    if (r.segs.every((rs, i) => rs.startsWith('[') || urlSegs[i] === '*' || rs === urlSegs[i])) { best = r; break }
  }
  return best
}

// ── Callers ─────────────────────────────────────────────────────────────────
function urlFrom(node) {
  if (!node) return null
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text
  if (ts.isTemplateExpression(node)) {
    let s = node.head.text
    for (const span of node.templateSpans) s += '\u0000' + span.literal.text
    return s
  }
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const l = urlFrom(node.left); if (l == null) return null
    const r = urlFrom(node.right)
    return l + (r == null ? '\u0000' : r)
  }
  return null
}
function toSegs(u) {
  // `${API_URL}/api/x` → '/api/x'; strip query/hash
  const i = u.indexOf('/api/'); if (i < 0) return null
  let p = u.slice(i).split(/[?#]/)[0]
  return p.split('/').filter(Boolean).map(s => (s.includes('\u0000') ? '*' : s))
}

const calls = []
const callerFiles = [...walk('app'), ...walk('components'), ...walk('lib'), ...walk('expo-app/app'), ...walk('expo-app/lib'), ...walk('expo-app/components'), ...walk('expo-app/hooks'), ...walk('public')]
for (const f of callerFiles) {
  const src = fs.readFileSync(f, 'utf8')
  if (!src.includes('/api/')) continue
  const sf = ts.createSourceFile(f, src, ts.ScriptTarget.Latest, true, f.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const at = n => `${norm(f)}:${sf.getLineAndCharacterOfPosition(n.getStart()).line + 1}`
  ;(function visit(n) {
    if (ts.isCallExpression(n)) {
      const callee = n.expression
      let method = null, urlNode = null
      if (ts.isIdentifier(callee) && callee.text === 'fetch') {
        urlNode = n.arguments[0]; method = 'GET'
        const opt = n.arguments[1]
        if (opt && ts.isObjectLiteralExpression(opt)) {
          const mp = opt.properties.find(p => p.name?.text === 'method')
          if (mp && ts.isPropertyAssignment(mp)) method = urlFrom(mp.initializer)?.toUpperCase() ?? '?'
        }
      } else if (ts.isPropertyAccessExpression(callee) && /^(get|post|put|patch|delete|del)$/.test(callee.name.text) && n.arguments.length) {
        const u = urlFrom(n.arguments[0])
        if (u && u.includes('/api/')) { urlNode = n.arguments[0]; method = callee.name.text === 'del' ? 'DELETE' : callee.name.text.toUpperCase() }
      }
      if (urlNode) {
        const u = urlFrom(urlNode)
        if (u && u.includes('/api/') && !/^https?:\/\/(?!\u0000)/.test(u.replace(/^\u0000/, ''))) {
          const segs = toSegs(u)
          if (segs) calls.push({ segs, method, where: at(n), kind: 'call' })
        }
      }
    }
    // JSX: <form action="/api/..." method="post">, href/src="/api/..."
    if (ts.isJsxAttribute(n) && n.initializer) {
      const name = n.name.getText(sf)
      let v = null
      if (ts.isStringLiteral(n.initializer)) v = n.initializer.text
      else if (ts.isJsxExpression(n.initializer) && n.initializer.expression) v = urlFrom(n.initializer.expression)
      if (v && v.includes('/api/') && ['action', 'href', 'src', 'formAction'].includes(name)) {
        let method = 'GET'
        if (name === 'action' || name === 'formAction') {
          const el = n.parent.parent
          const mAttr = el.attributes?.properties?.find(p => ts.isJsxAttribute(p) && p.name.getText(sf) === 'method')
          method = mAttr && ts.isStringLiteral(mAttr.initializer) ? mAttr.initializer.text.toUpperCase() : 'GET'
        }
        const segs = toSegs(v)
        if (segs) calls.push({ segs, method, where: at(n), kind: name })
      }
    }
    ts.forEachChild(n, visit)
  })(sf)
}

const missing = [], wrongMethod = []
for (const c of calls) {
  const r = matchRoute(c.segs)
  if (!r) { missing.push(c); continue }
  r.callers.push(c)
  if (c.method && c.method !== '?' && !r.methods.has(c.method)) wrongMethod.push({ ...c, route: r.url, has: [...r.methods].join(',') })
}

// Server-side references that aren't fetch calls: inngest serve, webhooks
// registered with third parties, links sent in WhatsApp/email bodies.
const EXTERNAL = [
  [/\/webhook|\/webhooks|\/itn|payfast-itn|paystack\/webhook|billing\/webhook|\/voice\//, 'webhook (3rd party calls it)'],
  [/\/api\/inngest$/, 'inngest serve'],
  [/\/api\/cron\//, 'cron (vercel.json)'],
  [/\/api\/widget\//, 'public embed widget'],
  [/\/api\/(book|survey|sign|portal|public|og|health|keepalive|status)/, 'public link / probe'],
  [/\/api\/auth\//, 'auth flow'],
  [/\/api\/integrations\/.*\/(callback|oauth)/, 'oauth callback'],
]
const vercel = fs.existsSync('vercel.json') ? fs.readFileSync('vercel.json', 'utf8') : ''
const orphans = routes.filter(r => !r.callers.length).map(r => {
  const ext = EXTERNAL.find(([re]) => re.test(r.url))
  const inVercel = vercel.includes(r.url)
  return { url: r.url, methods: [...r.methods].join(','), class: inVercel ? 'cron (vercel.json)' : ext ? ext[1] : 'NO UI' }
})
// Also: is the URL mentioned anywhere as a plain string (e.g. built for a WhatsApp message)?
const allSrc = callerFiles.map(f => fs.readFileSync(f, 'utf8')).join('\n') + fs.readFileSync('middleware.ts', 'utf8')
for (const o of orphans) if (o.class === 'NO UI') {
  const lit = o.url.replace(/\/\[[^\]]+\]/g, '/')
  if (allSrc.includes(lit.split('/[')[0] + '/') && lit.split('/').length > 3) o.class = 'NO UI? (url string appears in code)'
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ missing, wrongMethod, orphans }, null, 1))
} else {
  console.log(`routes: ${routes.length}, client calls found: ${calls.length}\n`)
  console.log(`== calls to routes that DON'T EXIST (${missing.length})`)
  for (const c of missing) console.log(`  ${c.method} /${c.segs.join('/')}  ${c.where}`)
  console.log(`\n== calls with a METHOD the route doesn't export (${wrongMethod.length})`)
  for (const c of wrongMethod) console.log(`  ${c.method} ${c.route} (exports ${c.has})  ${c.where}`)
  console.log(`\n== routes nothing calls (${orphans.length})`)
  const byClass = {}
  for (const o of orphans) (byClass[o.class] ||= []).push(o)
  for (const [k, l] of Object.entries(byClass)) {
    console.log(`  -- ${k} (${l.length})`)
    for (const o of l) console.log(`     ${o.methods.padEnd(18)} ${o.url}`)
  }
}
