// Schema-drift audit: extract every `.from('table').select('literal cols')` pair
// across app/ and validate the columns exist in prod. Resolves PostgREST aliases
// (`alias:real_col` → validates real_col). Skips select('*') and embeds `(...)`
// (PostgREST-only syntax SQL can't validate). Reports only mismatches (missing
// table or column). Run after schema changes or when adding pages/routes:
//   node scripts/audit_selects.mjs
// Session 14 used this to find ~25 silently-broken selects (swallowed by
// `data || []`). See verify_prod.mjs [page/api data contracts] for the CI-style
// guard on the critical subset.
import fs from 'fs'
import { execSync } from 'child_process'

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split(/\r?\n/).filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] }))
const MT = env.SUPABASE_ACCESS_TOKEN, REF = 'aetydnhnxmrsgqaqtofc'

async function sqlRaw(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST', headers: { Authorization: `Bearer ${MT}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  return r.json().catch(() => ({ message: 'unparseable' }))
}

// gather files
const files = execSync('find app -name "*.ts" -o -name "*.tsx"', { encoding: 'utf8' })
  .split('\n').filter(Boolean)

// find `.from('t')` then the nearest following `.select('...')` within 200 chars
const pairs = []
const re = /\.from\('([a-z_]+)'\)\s*(?:\/\/[^\n]*\n\s*)?\.select\(\s*'([^']*)'/g
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8')
  let m
  while ((m = re.exec(src))) {
    const [, table, cols] = m
    if (cols === '*' || cols.includes('(') || cols.includes('*')) continue // skip embeds / star
    const line = src.slice(0, m.index).split('\n').length
    // Resolve PostgREST aliases: `alias:real_col` → validate the real column.
    const realCols = cols.split(',').map(c => {
      const t = c.trim()
      return t.includes(':') ? t.split(':')[1].trim() : t
    }).join(', ')
    pairs.push({ f, line, table, cols: realCols.replace(/\s+/g, ' ').trim() })
  }
}

// dedupe identical (table, cols)
const seen = new Set()
const uniq = pairs.filter(p => { const k = p.table + '|' + p.cols; if (seen.has(k)) return false; seen.add(k); return true })

console.log(`Scanned ${files.length} files, ${pairs.length} literal selects (${uniq.length} unique table+cols).\n`)

let bad = 0
for (const p of uniq) {
  const res = await sqlRaw(`select ${p.cols} from public.${p.table} limit 0;`)
  if (!Array.isArray(res)) {
    bad++
    const msg = (res.message || '').split('\n')[0]
    console.log(`✗ ${p.table}  [${p.f}:${p.line}]`)
    console.log(`    ${msg}`)
    console.log(`    cols: ${p.cols}\n`)
  }
}
console.log(`\n${uniq.length - bad} ok, ${bad} mismatched.`)
