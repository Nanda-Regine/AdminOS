// Static insert audit: for every `.from('table').insert({...})` in app/api, check
// that every NOT-NULL-without-default column of that table is set by the insert.
// This is the static form of the invoice bug (contact_name NOT NULL, never set →
// every create 400'd). Flags likely-broken create routes without running them.
//   node scripts/audit_inserts.mjs
import fs from 'fs'
import path from 'path'

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split(/\r?\n/).filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] }))
const MT = env.SUPABASE_ACCESS_TOKEN
const REF = 'aetydnhnxmrsgqaqtofc'

async function sql(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST', headers: { Authorization: `Bearer ${MT}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  return await r.json().catch(() => [])
}

// Required (NOT NULL, no default) columns per table — the ones an insert MUST set.
const rows = await sql(`select table_name, column_name from information_schema.columns
  where table_schema='public' and is_nullable='NO' and column_default is null order by table_name;`)
const required = {}
for (const r of Array.isArray(rows) ? rows : []) (required[r.table_name] ??= []).push(r.column_name)

// Walk every route.ts, find .insert({...}) blocks and their nearest .from('table').
function walk(dir) {
  let out = []
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) out = out.concat(walk(p))
    else if (e.name === 'route.ts') out.push(p)
  }
  return out
}

// Extract the balanced {...} object starting at the first '{' after idx.
function objAt(src, idx) {
  const start = src.indexOf('{', idx)
  if (start < 0) return null
  let depth = 0
  for (let i = start; i < src.length; i++) {
    if (src[i] === '{') depth++
    else if (src[i] === '}') { depth--; if (depth === 0) return src.slice(start, i + 1) }
  }
  return null
}

// Top-level keys of an object literal (brace-depth 1, skip nested/paren).
function topKeys(obj) {
  const keys = []
  let depth = 0, paren = 0
  const lines = obj.split('\n')
  for (const line of lines) {
    for (const ch of line) { if (ch === '{') depth++; else if (ch === '}') depth--; else if (ch === '(') paren++; else if (ch === ')') paren--; }
    // Match `key:`, shorthand `key,` and trailing shorthand `key`. Also treat a
    // spread `...x` as "all bets off" — a spread may supply any column.
    if (/^\s*\.\.\./.test(line)) { keys.push('*SPREAD*'); continue }
    const m = line.match(/^\s*([a-z_][a-z0-9_]*)\s*(:|,|$)/i)
    if (m) keys.push(m[1])
  }
  return keys
}

let flags = 0, checked = 0, unresolved = 0
const files = walk('app/api')
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8')
  let searchFrom = 0
  while (true) {
    const ins = src.indexOf('.insert(', searchFrom)
    if (ins < 0) break
    searchFrom = ins + 7
    // nearest preceding .from('table')
    const before = src.slice(0, ins)
    const fromMatches = [...before.matchAll(/\.from\(\s*['"]([a-z_]+)['"]\s*\)/g)]
    const table = fromMatches.length ? fromMatches[fromMatches.length - 1][1] : null
    const obj = objAt(src, ins)
    if (!table || !obj) { unresolved++; continue }
    if (!(table in required)) { checked++; continue }        // table has no required cols
    const keys = new Set(topKeys(obj))
    if (keys.has('*SPREAD*')) { checked++; continue }   // a spread may supply anything — can't judge statically
    const missing = required[table].filter(c => !keys.has(c))
    checked++
    if (missing.length) {
      flags++
      console.log(`\n⚠ ${f.replace(/\\/g, '/').replace('app/api/', '')}`)
      console.log(`   table: ${table}`)
      console.log(`   NOT-NULL columns never set: ${missing.join(', ')}`)
    }
  }
}

console.log(`\n— ${checked} inserts checked, ${flags} with missing required columns, ${unresolved} unresolved —`)
