import { readFileSync } from 'fs'
import { join } from 'path'

const TOKEN = process.env.SUPABASE_PAT
const REF   = 'aetydnhnxmrsgqaqtofc'
const URL   = `https://api.supabase.com/v1/projects/${REF}/database/query`
const DIR   = 'C:\\Users\\Linda Mona\\OneDrive\\Documents\\AdminOS\\AdminOS\\supabase\\migrations'

async function sql(query, label) {
  const res = await fetch(URL, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  const body = await res.text()
  let msg = body
  try { msg = JSON.parse(body).message || body } catch { /**/ }
  const ok = res.status === 200 || res.status === 201
  console.log(ok ? `  ✓  ${label}` : `  ✗  ${label}\n     ${msg.substring(0, 250)}`)
  return ok
}

// Apply 002_v2_architecture with publication lines wrapped in DO blocks
let s = readFileSync(join(DIR, '002_v2_architecture.sql'), 'utf8')

// Fix RLS
s = s.replace(/\(auth\.jwt\(\)\s*->>\s*'tenant_id'\)::uuid/gi,
  `(auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid`)

// Wrap each ALTER PUBLICATION in a DO block with IF NOT EXISTS logic
s = s.replace(
  /ALTER PUBLICATION supabase_realtime ADD TABLE (\w+);/g,
  (match, tableName) => `
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = '${tableName}'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE ${tableName};
  END IF;
END $$;`
)

await sql(s, '002_v2_architecture.sql (publication fix)')
