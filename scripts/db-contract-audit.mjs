// DB contract audit — every Supabase touch in the codebase checked against the
// LIVE production schema (Session 20). Complements audit_selects.mjs, which
// validates select strings through PostgREST; this one covers what PostgREST
// can't check without running a write:
//   - unknown tables / views
//   - insert/update/upsert payload keys that aren't columns
//   - insert payloads missing a NOT NULL column that has no default
//   - filter/order columns (.eq/.in/.order/...) that aren't columns
//   - string literals written to / compared against enum or CHECK-constrained
//     columns that aren't legal values (the processQueue.ts status bug class)
//   - .rpc() functions and storage buckets that don't exist
//
// Uses the TypeScript AST, not regex, so chains split across lines, query
// builders reassigned (`q = q.eq(...)`) and payload variables declared as
// object literals are followed.
//
//   node scripts/db-contract-audit.mjs            (fetches live schema)
//   node scripts/db-contract-audit.mjs --json     (machine-readable)
//
// Heuristic: it is a static scan. Verify each finding by reading the code.

import fs from 'fs'
import path from 'path'
import ts from 'typescript'

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split(/\r?\n/).filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] }))
const ref = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0]

async function sql(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  if (!r.ok) throw new Error(`schema fetch failed: HTTP ${r.status}`)
  return r.json()
}

// ── Live schema ──────────────────────────────────────────────────────────────
const [cols, rels, checks, enums, fns, buckets] = await Promise.all([
  sql(`select table_name t, column_name c, udt_name udt, is_nullable n, column_default d, is_generated g, identity_generation ig
       from information_schema.columns where table_schema='public'`),
  sql(`select c.relname t, c.relkind k from pg_class c join pg_namespace n on n.oid=c.relnamespace
       where n.nspname='public' and c.relkind in ('r','v','m','p')`),
  sql(`select conrelid::regclass::text t, pg_get_constraintdef(oid) def from pg_constraint
       where contype='c' and connamespace='public'::regnamespace`),
  sql(`select t.typname, array_agg(e.enumlabel::text order by e.enumsortorder) labels
       from pg_type t join pg_enum e on e.enumtypid=t.oid group by t.typname`),
  sql(`select p.proname, pg_get_function_identity_arguments(p.oid) args from pg_proc p
       where p.pronamespace='public'::regnamespace`),
  sql(`select id from storage.buckets`),
])
// Unique keys usable as ON CONFLICT arbiters: non-partial unique indexes whose
// constraint (if any) is NOT deferrable. Postgres rejects deferrable ones.
const uniq = await sql(`select c.relname t, array_to_string(array(select a.attname from unnest(i.indkey) k join pg_attribute a on a.attrelid=i.indrelid and a.attnum=k order by a.attname), ',') cols,
  coalesce(con.condeferrable,false) deferrable, i.indpred is not null partial, i.indisprimary pk
  from pg_index i join pg_class c on c.oid=i.indrelid join pg_namespace n on n.oid=c.relnamespace
  left join pg_constraint con on con.conindid=i.indexrelid
  where n.nspname='public' and i.indisunique`)
const arbiters = new Map()
for (const u of uniq) (arbiters.get(u.t) || arbiters.set(u.t, []).get(u.t)).push(u)

const tables = new Map() // name -> { kind, cols: Map(col -> meta) }
for (const r of rels) tables.set(r.t, { kind: r.k, cols: new Map() })
for (const c of cols) tables.get(c.t)?.cols.set(c.c, c)
const enumLabels = new Map(enums.map(e => [e.typname, e.labels]))

// Allowed literal values per table.col from enums + CHECK (col = ANY (ARRAY['a'::text, ...]))
const allowed = new Map()
for (const c of cols) if (enumLabels.has(c.udt)) allowed.set(`${c.t}.${c.c}`, new Set(enumLabels.get(c.udt)))
for (const { t, def } of checks) {
  const table = t.replace(/^public\./, '').replace(/"/g, '')
  // ((status)::text = ANY ((ARRAY['a'::character varying, ...])::text[]))  or  (status = ANY (ARRAY[...]))
  const m = def.match(/^CHECK \(\(?\(?([a-z_]+)\)?(?:::[a-z ]+)?\s*=\s*ANY\s*\(+ARRAY\[(.+?)\]/)
  if (!m) continue
  // Only accept a constraint that is purely a value list (optionally "OR col IS NULL").
  const vals = [...m[2].matchAll(/'([^']*)'/g)].map(x => x[1])
  if (vals.length) allowed.set(`${table}.${m[1]}`, new Set(vals))
}
const fnNames = new Set(fns.map(f => f.proname))
const bucketIds = new Set(buckets.map(b => b.id))

// ── Source walk ──────────────────────────────────────────────────────────────
const ROOTS = ['app', 'lib', 'inngest', 'components']
const files = []
function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name)
    if (e.isDirectory()) { if (e.name !== 'node_modules') walk(p) }
    else if (/\.(ts|tsx)$/.test(e.name) && !e.name.endsWith('.d.ts')) files.push(p)
  }
}
ROOTS.forEach(r => fs.existsSync(r) && walk(r))

const FILTERS = new Set(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'is', 'in', 'contains', 'containedBy', 'order', 'not', 'filter', 'textSearch', 'overlaps'])
const VALUE_FILTERS = new Set(['eq', 'neq', 'in'])
const findings = []
const selects = []
const softReads = []
const stats = { resolved: 0, unresolved: 0, unresolvedAt: [] }
const usedTables = new Set()

function lit(n) {
  if (!n) return undefined
  if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) return n.text
  return undefined
}
function stripCol(c) {
  // 'contacts.name' (embedded filter) / 'meta->>key' (json path) / 'col.asc'
  if (c.includes('->')) c = c.split('->')[0]
  return c
}

for (const file of files) {
  const src = fs.readFileSync(file, 'utf8')
  if (!src.includes('.from(') && !src.includes('.rpc(') && !src.includes('storage')) continue
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const rel = file.replace(/\\/g, '/')
  const at = n => `${rel}:${sf.getLineAndCharacterOfPosition(n.getStart()).line + 1}`

  // file-level string consts (const TABLE = 'x')
  const strConsts = new Map()
  // object-literal variables, for `.insert(payload)`
  const objVars = new Map()
  ;(function collect(n) {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer) {
      const s = lit(n.initializer)
      if (s !== undefined) strConsts.set(n.name.text, s)
      let init = n.initializer
      while (ts.isAsExpression(init) || ts.isSatisfiesExpression?.(init) || ts.isParenthesizedExpression(init)) init = init.expression
      if (ts.isObjectLiteralExpression(init)) objVars.set(n.name.text, init)
    }
    ts.forEachChild(n, collect)
  })(sf)

  const resolveStr = n => lit(n) ?? (n && ts.isIdentifier(n) ? strConsts.get(n.text) : undefined)

  // Builder variables: `const q = supabase.from('x')...` / `let query = ...`
  const builderVars = new Map() // name -> table

  function objKeys(o) {
    const keys = []; let spread = false
    for (const p of o.properties) {
      if (ts.isSpreadAssignment(p)) { spread = true; continue }
      const name = p.name && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) ? p.name.text : undefined
      if (!name) { spread = true; continue } // computed key
      const valNode = ts.isPropertyAssignment(p) ? p.initializer : undefined
      keys.push({ name, valNode, node: p })
    }
    return { keys, spread }
  }

  function payloadObjects(arg) {
    if (!arg) return []
    let a = arg
    while (ts.isAsExpression(a) || ts.isParenthesizedExpression(a)) a = a.expression
    if (ts.isObjectLiteralExpression(a)) return [a]
    if (ts.isArrayLiteralExpression(a)) return a.elements.filter(ts.isObjectLiteralExpression)
    if (ts.isIdentifier(a) && objVars.has(a.text)) return [objVars.get(a.text)]
    // rows.map(r => ({...}))
    if (ts.isCallExpression(a) && ts.isPropertyAccessExpression(a.expression) && a.expression.name.text === 'map') {
      const fn = a.arguments[0]
      if (fn && (ts.isArrowFunction(fn))) {
        let b = fn.body
        while (ts.isParenthesizedExpression(b)) b = b.expression
        if (ts.isObjectLiteralExpression(b)) return [b]
      }
    }
    return []
  }

  function checkValue(table, col, valNode, where, how) {
    const set = allowed.get(`${table}.${col}`)
    if (!set || !valNode) return
    const vals = []
    const v = lit(valNode)
    if (v !== undefined) vals.push(v)
    if (ts.isArrayLiteralExpression(valNode)) valNode.elements.forEach(e => { const s = lit(e); if (s !== undefined) vals.push(s) })
    if (ts.isConditionalExpression(valNode)) [valNode.whenTrue, valNode.whenFalse].forEach(e => { const s = lit(e); if (s !== undefined) vals.push(s) })
    for (const s of vals) if (!set.has(s))
      findings.push({ kind: 'illegal-value', table, col, value: s, where, how, allowed: [...set].join('|') })
  }

  function processChain(table, startCall, viaVar) {
    const t = tables.get(table)
    usedTables.add(table)
    if (!t) { findings.push({ kind: 'unknown-table', table, where: at(startCall) }); return }
    let node = startCall
    let op = viaVar ? 'select' : null
    let hasDeletedFilter = false, byId = false, isCount = false, sawSelect = false, selectEnd = -1
    while (node.parent && ts.isPropertyAccessExpression(node.parent) && node.parent.parent && ts.isCallExpression(node.parent.parent) && node.parent.parent.expression === node.parent) {
      const method = node.parent.name.text
      const call = node.parent.parent
      const args = call.arguments
      if (['insert', 'update', 'upsert'].includes(method)) {
        op = method
        if (method === 'upsert') {
          const opt = args[1] && ts.isObjectLiteralExpression(args[1]) ? args[1].properties.find(p => p.name?.text === 'onConflict') : null
          const target = opt && ts.isPropertyAssignment(opt) ? lit(opt.initializer) : ((arbiters.get(table) || []).find(u => u.pk)?.cols ?? 'id')
          if (target !== undefined) {
            const want = target.split(',').map(x => x.trim()).sort().join(',')
            const cands = (arbiters.get(table) || []).filter(u => u.cols === want)
            if (!cands.length) findings.push({ kind: 'bad-upsert-target', table, col: want, where: at(call), how: 'no unique key on these columns' })
            else if (cands.every(u => u.deferrable || u.partial)) findings.push({ kind: 'bad-upsert-target', table, col: want, where: at(call), how: cands[0].deferrable ? 'unique key is DEFERRABLE (Postgres rejects it)' : 'only a PARTIAL unique index' })
          }
        }
        const objs = payloadObjects(args[0]); stats[objs.length ? 'resolved' : 'unresolved']++
        if (!objs.length) stats.unresolvedAt.push(at(call))
        for (const o of objs) {
          const { keys, spread } = objKeys(o)
          for (const k of keys) {
            if (!t.cols.has(k.name)) findings.push({ kind: 'unknown-write-col', table, col: k.name, where: at(k.node), how: method })
            else checkValue(table, k.name, k.valNode, at(k.node), method)
          }
          if ((method === 'insert' || method === 'upsert') && !spread && t.kind === 'r') {
            const have = new Set(keys.map(k => k.name))
            for (const [c, m] of t.cols) {
              if (m.n === 'NO' && m.d == null && m.g !== 'ALWAYS' && !m.ig && !have.has(c))
                findings.push({ kind: 'missing-required-col', table, col: c, where: at(o), how: method })
            }
          }
        }
      } else if (FILTERS.has(method)) {
        let c = resolveStr(args[0])
        if (c === 'deleted_at') hasDeletedFilter = true
        if (c === 'id' && method === 'eq') byId = true
        if (c !== undefined && method !== 'filter' && method !== 'not' || (c !== undefined && ['filter', 'not'].includes(method))) {
          c = stripCol(c)
          if (!c.includes('.') && !t.cols.has(c))
            findings.push({ kind: 'unknown-filter-col', table, col: c, where: at(call), how: method })
          else if (!c.includes('.') && VALUE_FILTERS.has(method)) checkValue(table, c, args[1], at(call), method)
        }
      } else if (method === 'match' && args[0] && ts.isObjectLiteralExpression(args[0])) {
        for (const k of objKeys(args[0]).keys) {
          if (!t.cols.has(k.name)) findings.push({ kind: 'unknown-filter-col', table, col: k.name, where: at(k.node), how: 'match' })
          else checkValue(table, k.name, k.valNode, at(k.node), 'match')
        }
      } else if (method === 'select') {
        sawSelect = true; selectEnd = call.getEnd()
        if (args[1] && ts.isObjectLiteralExpression(args[1]) && args[1].properties.some(p => p.name?.text === 'head')) isCount = true
        const cols = lit(args[0])
        if (cols !== undefined && cols.trim() && cols.trim() !== '*') selects.push({ table, cols: cols.replace(/\s+/g, ' ').trim(), where: at(call) })
      }
      node = call
    }
    if (!op && sawSelect && t.cols.has('deleted_at') && !hasDeletedFilter && !viaVar) {
      let p2 = node.parent
      while (p2 && (ts.isAwaitExpression(p2) || ts.isParenthesizedExpression(p2) || ts.isAsExpression(p2))) p2 = p2.parent
      const assigned = p2 && (ts.isVariableDeclaration(p2) || (ts.isBinaryExpression(p2) && p2.operatorToken.kind === ts.SyntaxKind.EqualsToken))
      const insideLive = node.parent && ts.isCallExpression(node.parent) && ts.isIdentifier(node.parent.expression) && node.parent.expression.text === 'live'
      if (!insideLive) softReads.push({ table, file, selectEnd, where: at(startCall), byId, isCount, builder: !!assigned && !ts.isAwaitExpression(node.parent) })
    }
    // Chain assigned to a variable → follow later `v.eq(...)` / `v = v.eq(...)`
    let p = node.parent
    while (p && (ts.isAwaitExpression(p) || ts.isParenthesizedExpression(p) || ts.isAsExpression(p))) p = p.parent
    if (p && ts.isVariableDeclaration(p) && ts.isIdentifier(p.name)) builderVars.set(p.name.text, table)
    if (p && ts.isBinaryExpression(p) && p.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isIdentifier(p.left)) builderVars.set(p.left.text, table)
  }

  ;(function visit(n) {
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)) {
      const name = n.expression.name.text
      const recv = n.expression.expression
      if (name === 'from') {
        const isStorage = ts.isPropertyAccessExpression(recv) && recv.name.text === 'storage'
        const s = resolveStr(n.arguments[0])
        if (isStorage) {
          if (s !== undefined && !bucketIds.has(s)) findings.push({ kind: 'unknown-bucket', table: s, where: at(n) })
        } else if (s !== undefined && /^[a-z_][a-z0-9_]*$/.test(s)) {
          processChain(s, n, false)
        }
      } else if (name === 'rpc') {
        const s = resolveStr(n.arguments[0])
        if (s !== undefined && !fnNames.has(s)) findings.push({ kind: 'unknown-rpc', table: s, where: at(n) })
      } else if (ts.isIdentifier(recv) && builderVars.has(recv.text) && FILTERS.has(name)) {
        // `q.eq(...)` on a tracked builder: treat `recv` as the chain start.
        const table = builderVars.get(recv.text)
        const t = tables.get(table)
        const c0 = resolveStr(n.arguments[0])
        if (t && c0 !== undefined) {
          const c = stripCol(c0)
          if (!c.includes('.') && !t.cols.has(c)) findings.push({ kind: 'unknown-filter-col', table, col: c, where: at(n), how: name })
          else if (!c.includes('.') && VALUE_FILTERS.has(name)) checkValue(table, c, n.arguments[1], at(n), name)
        }
      }
    }
    ts.forEachChild(n, visit)
  })(sf)
}

// Selects: validate the exact select string through PostgREST (service role,
// limit=0, nothing returned) — embeds, aliases and casts resolve exactly as the
// app runs them.
const U = env.NEXT_PUBLIC_SUPABASE_URL, KEY = env.SUPABASE_SERVICE_ROLE_KEY
const selSeen = new Map()
for (const q of selects) { const k = q.table + '|' + q.cols; if (!selSeen.has(k)) selSeen.set(k, q) }
const selList = [...selSeen.values()]
for (let i = 0; i < selList.length; i += 8) {
  await Promise.all(selList.slice(i, i + 8).map(async q => {
    if (!tables.has(q.table)) return
    const sel = q.cols.replace(/\s+/g, '')
    const r = await fetch(`${U}/rest/v1/${q.table}?select=${encodeURIComponent(sel)}&limit=0`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } })
    if (!r.ok) {
      const j = await r.json().catch(() => ({}))
      findings.push({ kind: 'bad-select', table: q.table, where: q.where, how: (j.message || 'HTTP ' + r.status) + '  ⟵ ' + q.cols.slice(0, 160) })
    }
  }))
}
console.error(`selects validated: ${selList.length} unique`)

if (process.argv.includes('--fix-soft')) {
  // Codemod: append .is('deleted_at', null) right after the select() of every
  // complete (non-builder) chain. Builder-variable chains are left for a human.
  const SKIP = ['compliance/delete-contact']
  const byFile = {}
  for (const r of softReads) if ((process.argv.includes('--include-builders') || !r.builder) && r.selectEnd > 0 && !SKIP.some(x => r.where.includes(x))) (byFile[r.file] ||= []).push(r.selectEnd)
  let n = 0
  for (const [file, ends] of Object.entries(byFile)) {
    let src = fs.readFileSync(file, 'utf8')
    for (const e of [...new Set(ends)].sort((a, b) => b - a)) { src = src.slice(0, e) + ".is('deleted_at', null)" + src.slice(e); n++ }
    fs.writeFileSync(file, src)
  }
  console.log('inserted', n, 'filters in', Object.keys(byFile).length, 'files')
  process.exit(0)
}
if (process.argv.includes('--soft')) {
  const byT = {}
  for (const r of softReads) (byT[r.table] ||= []).push(r)
  for (const [t, l] of Object.entries(byT).sort((a,b)=>b[1].length-a[1].length)) console.log(`${t}: ${l.length} reads w/o deleted_at filter (${l.filter(x=>x.byId).length} by id, ${l.filter(x=>x.builder).length} builder-vars)`)
  console.log('TOTAL', softReads.length)
  if (process.argv.includes('--soft-list')) for (const r of softReads) console.log(`  ${r.table}${r.byId?' [id]':''}${r.builder?' [builder]':''}${r.isCount?' [count]':''}  ${r.where}`)
  process.exit(0)
}
// Dedupe identical findings
const seen = new Set()
const out = findings.filter(f => { const k = JSON.stringify(f); if (seen.has(k)) return false; seen.add(k); return true })

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ findings: out, unusedTables: [...tables.keys()].filter(t => !usedTables.has(t)) }, null, 1))
} else {
  const byKind = {}
  for (const f of out) (byKind[f.kind] ||= []).push(f)
  for (const [k, list] of Object.entries(byKind)) {
    console.log(`\n== ${k} (${list.length})`)
    for (const f of list) console.log(`  ${f.table}${f.col ? '.' + f.col : ''}${f.value !== undefined ? ` = '${f.value}' (allowed: ${f.allowed})` : ''}${f.how ? ` [${f.how}]` : ''}  ${f.where}`)
  }
  const unused = [...tables.keys()].filter(t => !usedTables.has(t)).sort()
  console.log(`\n== tables/views never referenced by code (${unused.length})\n  ${unused.join(', ')}`)
  console.log(`\nwrite payloads resolved: ${stats.resolved}, unresolved: ${stats.unresolved}`)
  if (process.argv.includes('--unresolved')) console.log(stats.unresolvedAt.join('\n'))
  console.log(`\nfiles scanned: ${files.length}, findings: ${out.length}`)
}
