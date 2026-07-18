// Schema-drift audit: extract every `.from('table').select('literal cols')` pair
// across app/ and validate the EXACT PostgREST query resolves against prod — via
// the REST endpoint (service role), so embeds `contacts(name,…)`, aliases
// `name:full_name`, and plain column lists are all validated the same way the app
// runs them. Skips only select('*') (nothing to check) and dynamic/templated
// selects (can't extract). Reports mismatches (missing table/column/relationship).
//   node scripts/audit_selects.mjs
// Session 14 used this to find ~25 silently-broken selects (swallowed by
// `data || []`). verify_prod.mjs [page/api data contracts] guards the critical subset.
import fs from 'fs'
import { execSync } from 'child_process'

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split(/\r?\n/).filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] }))
const U = env.NEXT_PUBLIC_SUPABASE_URL
const KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY

async function check(table, cols) {
  // PostgREST select strings can contain spaces after commas; strip them so the
  // querystring is valid (embeds keep their parens).
  const sel = cols.replace(/,\s+/g, ',').trim()
  const r = await fetch(`${U}/rest/v1/${table}?select=${encodeURIComponent(sel)}&limit=0`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
  })
  if (r.ok) return null
  const j = await r.json().catch(() => ({}))
  return j.message || `HTTP ${r.status}`
}

const files = execSync('find app -name "*.ts" -o -name "*.tsx"', { encoding: 'utf8' }).split('\n').filter(Boolean)

// `.from('t')` then the nearest following `.select('...')` within the chain.
const re = /\.from\('([a-z_]+)'\)\s*(?:\/\/[^\n]*\n\s*)?\.select\(\s*'([^']*)'/g
const pairs = []
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8')
  let m
  while ((m = re.exec(src))) {
    const [, table, cols] = m
    if (cols === '*' || cols.trim() === '') continue
    const line = src.slice(0, m.index).split('\n').length
    pairs.push({ f, line, table, cols: cols.replace(/\s+/g, ' ').trim() })
  }
}

const seen = new Set()
const uniq = pairs.filter(p => { const k = p.table + '|' + p.cols; if (seen.has(k)) return false; seen.add(k); return true })
console.log(`Scanned ${files.length} files, ${pairs.length} literal selects (${uniq.length} unique).\n`)

let bad = 0
for (const p of uniq) {
  const err = await check(p.table, p.cols)
  if (err) {
    bad++
    console.log(`✗ ${p.table}  [${p.f}:${p.line}]`)
    console.log(`    ${err}`)
    console.log(`    cols: ${p.cols}\n`)
  }
}
console.log(`\n${uniq.length - bad} ok, ${bad} mismatched.`)
