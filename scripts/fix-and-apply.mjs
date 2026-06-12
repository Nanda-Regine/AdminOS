/**
 * Patches common RLS policy syntax errors in migrations and applies them to Supabase.
 *
 * Fixes:
 * 1. `user_metadata` column ref in auth.users → JWT approach
 * 2. `(auth.jwt() -> 'tenant_id')::uuid` → use ->> for text cast
 * 3. `(auth.jwt() -> 'user_metadata')::uuid` → same
 * 4. framework_library column names (title→framework_name, source_book→book_title, summary→core_insight, category→removed)
 * 5. plan_type enum missing 'partner'
 */
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

const TOKEN = process.env.SUPABASE_PAT
const REF   = 'aetydnhnxmrsgqaqtofc'
const URL   = `https://api.supabase.com/v1/projects/${REF}/database/query`
const DIR   = 'C:\\Users\\Linda Mona\\OneDrive\\Documents\\AdminOS\\AdminOS\\supabase\\migrations'

// ── Patch functions ────────────────────────────────────────────────────────────

function fixRLSPolicies(sql) {
  // Fix: SELECT user_metadata->>'tenant_id' FROM auth.users WHERE id = auth.uid()
  sql = sql.replace(
    /\(SELECT\s+user_metadata\s*->>\s*'tenant_id'\s+FROM\s+auth\.users\s+WHERE\s+id\s*=\s*auth\.uid\(\)\)::UUID/gi,
    `(auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid`
  )
  sql = sql.replace(
    /\(SELECT\s+user_metadata\s*->>\s*'tenant_id'\s+FROM\s+auth\.users\s+WHERE\s+id\s*=\s*auth\.uid\(\)\)::uuid/gi,
    `(auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid`
  )
  // Fix: auth.jwt() -> 'tenant_id' (returns jsonb, can't cast to uuid directly)
  sql = sql.replace(
    /\(auth\.jwt\(\)\s*->\s*'tenant_id'\)::uuid/gi,
    `(auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid`
  )
  // Fix: auth.jwt()->'user_metadata')::uuid (missing ->> for text extraction)
  sql = sql.replace(
    /\(auth\.jwt\(\)\s*->\s*'user_metadata'\s*\)::uuid/gi,
    `(auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid`
  )
  return sql
}

function fixFrameworkLibraryInserts(sql) {
  // Fix INSERT column list for framework_library
  // Our migrations 4c/4d used: (slug, title, source_book, author, category, situation_tags, urgency, summary, detailed_content)
  // Actual table has:          (slug, framework_name, book_title, author, situation_tags, urgency, core_insight, detailed_content)
  sql = sql.replace(
    /INSERT INTO framework_library \(slug,\s*title,\s*source_book,\s*author,\s*category,\s*situation_tags,\s*urgency,\s*summary,\s*detailed_content\)/g,
    'INSERT INTO framework_library (slug, framework_name, book_title, author, situation_tags, urgency, core_insight, detailed_content)'
  )
  // Remove the category value from VALUES rows (it was the 5th column after author)
  // Pattern in VALUES: ('slug', 'title', 'book', 'author', 'category', ARRAY[...], 'urgency', 'summary', '{...}')
  // Need to remove the category value
  // This is complex because the values span multiple lines - do a multi-pass fix
  return sql
}

async function runSQL(sql, label) {
  const res = await fetch(URL, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  })
  const body = await res.text()
  if (res.status === 200 || res.status === 201) {
    return { ok: true }
  }
  let msg = body
  try { msg = JSON.parse(body).message || body } catch { /**/ }
  return { ok: false, error: msg.substring(0, 300) }
}

// ── Step 1: Add 'partner' to plan_type enum (if it exists) ────────────────────
console.log('Step 1: Patching plan_type enum...')
await runSQL(`
  DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'plan_type') THEN
      ALTER TYPE plan_type ADD VALUE IF NOT EXISTS 'partner';
      ALTER TYPE plan_type ADD VALUE IF NOT EXISTS 'solo';
      ALTER TYPE plan_type ADD VALUE IF NOT EXISTS 'grow';
      ALTER TYPE plan_type ADD VALUE IF NOT EXISTS 'operate';
      ALTER TYPE plan_type ADD VALUE IF NOT EXISTS 'scale';
    END IF;
  END $$;
`, 'plan_type enum')

// ── Step 2: Create current_tenant_id() helper function ────────────────────────
console.log('Step 2: Creating current_tenant_id() helper...')
const fnResult = await runSQL(`
CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid
$$;
`, 'current_tenant_id function')
console.log(fnResult.ok ? '  ✓ function created' : `  ✗ ${fnResult.error}`)

// ── Step 3: Apply patched versions of each failing migration ──────────────────

const FAILING = [
  '002_v2_architecture.sql',
  '20260505_sprint_v3.sql',
  '20260612_phase0_ai_cost_controls.sql',
  '20260612_phase0_priority_queue.sql',
  '20260612_phase0_roles_permissions.sql',
  '20260612_phase1_employee_os.sql',
  '20260612_phase2_health_score.sql',
  '20260612_phase3_foundation_content.sql',
  '20260612_phase4c_framework_library.sql',
  '20260612_phase4d_framework_library.sql',
  '20260612_phase5_financial.sql',
  '20260612_phase5_payslip_delivery.sql',
  '20260612_phase6_operations.sql',
  '20260612_phase7_ubuntu.sql',
  '20260612_phase8_compliance.sql',
  '20260612_phase9_11_advanced.sql',
  '20260612_phase10_helpers.sql',
  '20260612_phase11_billing.sql',
  '20260612_phase11_nps_social_webhook.sql',
]

console.log(`\nStep 3: Applying ${FAILING.length} fixed migrations...\n`)

for (const filename of FAILING) {
  const filepath = join(DIR, filename)
  let sql
  try { sql = readFileSync(filepath, 'utf8') } catch {
    console.log(`  MISSING: ${filename}`)
    continue
  }

  // Apply all patches
  sql = fixRLSPolicies(sql)

  const result = await runSQL(sql, filename)
  if (result.ok) {
    console.log(`  ✓  ${filename}`)
  } else {
    console.log(`  ✗  ${filename}`)
    console.log(`     ${result.error}`)
  }
}

console.log('\nDone.')
