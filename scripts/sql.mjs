// Run read-only SQL against prod via the Supabase Management API.
// Usage: node scripts/sql.mjs "select 1"   |   node scripts/sql.mjs -f file.sql
// Reads SUPABASE_ACCESS_TOKEN from .env.local; never prints it.
import fs from 'fs'
const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split(/\r?\n/).filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] }))
const ref = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0]
const arg = process.argv[2] === '-f' ? fs.readFileSync(process.argv[3], 'utf8') : process.argv.slice(2).join(' ')
const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: arg }),
})
const t = await r.text()
if (!r.ok) { console.error('HTTP', r.status, t.slice(0, 500)); process.exit(1) }
const rows = JSON.parse(t)
if (process.env.JSON) console.log(JSON.stringify(rows))
else if (Array.isArray(rows) && rows.length) console.table(rows)
else console.log(rows)
