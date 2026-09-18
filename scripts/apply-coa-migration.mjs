import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { join, dirname } from 'path'

const TOKEN = process.env.SUPABASE_ACCESS_TOKEN ?? process.env.SUPABASE_PAT
const REF   = 'aetydnhnxmrsgqaqtofc'
const API_URL = `https://api.supabase.com/v1/projects/${REF}/database/query`
const __dirname = dirname(fileURLToPath(import.meta.url))

async function sql(query, label) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  const body = await res.text()
  let msg = body
  try { msg = JSON.parse(body).message || body } catch { /**/ }
  const ok = res.status === 200 || res.status === 201
  console.log(ok ? `  ok - ${label}` : `  FAILED - ${label}\n     ${msg.substring(0, 300)}`)
  return ok
}

const migration = readFileSync(join(__dirname, '../supabase/migrations/20260918_chart_of_accounts.sql'), 'utf8')
await sql(migration, '20260918_chart_of_accounts.sql')

// Verify
const check = await fetch(API_URL, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: `SELECT column_name FROM information_schema.columns WHERE table_name = 'invoices' AND column_name IN ('category','channel','payment_method') ORDER BY column_name;`,
  }),
})
console.log('\nVerify:', await check.text())
