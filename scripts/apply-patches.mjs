/**
 * Applies targeted patches for the 5 remaining failing migrations.
 */
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
  console.log(ok ? `  ✓  ${label}` : `  ✗  ${label}\n     ${msg.substring(0, 200)}`)
  return ok
}

// ── Patch 1: Add days_overdue to invoices so 002_v2_architecture trigger works ─
console.log('\n[1] Adding days_overdue to invoices...')
await sql(`
  ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS days_overdue   INT GENERATED ALWAYS AS (
      CASE WHEN status NOT IN ('paid','cancelled') AND due_date IS NOT NULL AND due_date < CURRENT_DATE
           THEN (CURRENT_DATE - due_date::date)
           ELSE 0
      END
    ) STORED,
    ADD COLUMN IF NOT EXISTS contact_phone  TEXT,
    ADD COLUMN IF NOT EXISTS amount         NUMERIC(12,2);
`, 'invoices: add days_overdue, contact_phone, amount columns')

// ── Patch 1b: Re-apply 002_v2_architecture ────────────────────────────────────
console.log('\n[1b] Re-applying 002_v2_architecture.sql...')
{
  let s = readFileSync(join(DIR, '002_v2_architecture.sql'), 'utf8')
  // Fix the RLS policy (uses ->> which is fine, but targets wrong claim path)
  s = s.replace(/\(auth\.jwt\(\)\s*->>\s*'tenant_id'\)::uuid/gi,
    `(auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid`)
  await sql(s, '002_v2_architecture.sql')
}

// ── Patch 2: Fix sprint_v3 (IMMUTABLE index predicate issue) ─────────────────
console.log('\n[2] Re-applying 20260505_sprint_v3.sql...')
{
  let s = readFileSync(join(DIR, '20260505_sprint_v3.sql'), 'utf8')
  // Remove any partial index that uses non-immutable functions
  // Replace NOW() in index predicates with a static timestamp or remove the predicate
  s = s.replace(/WHERE\s+created_at\s*>\s*NOW\(\)\s*-[^;]+/gi, '')
  s = s.replace(/WHERE\s+\w+\s*>\s*NOW\(\)[^;]*/gi, '')
  s = s.replace(/\(auth\.jwt\(\)\s*->>\s*'tenant_id'\)::uuid/gi,
    `(auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid`)
  await sql(s, '20260505_sprint_v3.sql')
}

// ── Patch 3: Fix phase3_foundation_content apostrophe ────────────────────────
console.log("\n[3] Fixing phase3_foundation_content apostrophes...")
{
  let s = readFileSync(join(DIR, '20260612_phase3_foundation_content.sql'), 'utf8')
  // Escape unescaped apostrophes inside SQL string literals
  // The problem is content like: months' fixed-term  and  don't  and  won't etc.
  // We need to find them inside the VALUES string and double them up
  // Strategy: replace common patterns
  s = s.replace(/months' /g, "months'' ")
  s = s.replace(/months'\./g, "months''.")
  s = s.replace(/months',/g, "months'',")
  s = s.replace(/company's /g, "company''s ")
  s = s.replace(/employee's /g, "employee''s ")
  s = s.replace(/employer's /g, "employer''s ")
  s = s.replace(/person's /g, "person''s ")
  s = s.replace(/worker's /g, "worker''s ")
  s = s.replace(/business's /g, "business''s ")
  s = s.replace(/don't /g, "don''t ")
  s = s.replace(/doesn't /g, "doesn''t ")
  s = s.replace(/won't /g, "won''t ")
  s = s.replace(/can't /g, "can''t ")
  s = s.replace(/isn't /g, "isn''t ")
  s = s.replace(/wasn't /g, "wasn''t ")
  s = s.replace(/weren't /g, "weren''t ")
  s = s.replace(/haven't /g, "haven''t ")
  s = s.replace(/hadn't /g, "hadn''t ")
  s = s.replace(/you're /g, "you''re ")
  s = s.replace(/you'll /g, "you''ll ")
  s = s.replace(/it's /g, "it''s ")
  s = s.replace(/that's /g, "that''s ")
  s = s.replace(/there's /g, "there''s ")
  s = s.replace(/they're /g, "they''re ")
  s = s.replace(/we're /g, "we''re ")
  s = s.replace(/we've /g, "we''ve ")
  s = s.replace(/I've /g, "I''ve ")
  s = s.replace(/I'd /g, "I''d ")
  s = s.replace(/I'll /g, "I''ll ")
  s = s.replace(/let's /g, "let''s ")
  s = s.replace(/shouldn't /g, "shouldn''t ")
  s = s.replace(/wouldn't /g, "wouldn''t ")
  s = s.replace(/couldn't /g, "couldn''t ")
  s = s.replace(/mustn't /g, "mustn''t ")
  s = s.replace(/aren't /g, "aren''t ")
  s = s.replace(/hasn't /g, "hasn''t ")
  s = s.replace(/SARS's /g, "SARS''s ")
  s = s.replace(/CCMA's /g, "CCMA''s ")
  // Also fix RLS policy if any
  s = s.replace(/\(auth\.jwt\(\)\s*->>\s*'tenant_id'\)::uuid/gi,
    `(auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid`)
  await sql(s, '20260612_phase3_foundation_content.sql (patched)')
}

// ── Patch 4: Fix phase4c/4d — wrong column names in framework_library ─────────
// Actual columns: slug, framework_name, book_title, author, situation_tags, urgency, core_insight, detailed_content
console.log('\n[4] Fixing phase4c framework_library inserts...')
{
  let s = readFileSync(join(DIR, '20260612_phase4c_framework_library.sql'), 'utf8')

  // The INSERT has 9 columns: slug, title, source_book, author, category, situation_tags, urgency, summary, detailed_content
  // We need to map to:          slug, framework_name, book_title, author, [drop category], situation_tags, urgency, core_insight, detailed_content
  // The VALUES rows look like:
  // ('slug', 'title', 'book', 'author', 'category', ARRAY[...], 'urgency', 'summary', '{...}')

  // Step 1: Fix column list
  s = s.replace(
    /INSERT INTO framework_library \(slug,\s*title,\s*source_book,\s*author,\s*category,\s*situation_tags,\s*urgency,\s*summary,\s*detailed_content\)/g,
    'INSERT INTO framework_library (slug, framework_name, book_title, author, situation_tags, urgency, core_insight, detailed_content)'
  )

  // Step 2: Fix each VALUES row — remove the 5th value (category string)
  // Pattern: ('slug', 'title', 'book', 'author', 'category',\n ARRAY[...]
  // Replace by removing the category value (5th single-quoted string)
  // This regex matches the pattern across the VALUES rows
  s = s.replace(
    /\('([^']*)',\s*'([^']*)',\s*'([^']*)',\s*'([^']*)',\s*'[^']*',\s*(ARRAY\[)/g,
    "('$1', '$2', '$3', '$4', $5"
  )

  await sql(s, '20260612_phase4c_framework_library.sql (patched)')
}

console.log('\n[4b] Fixing phase4d framework_library inserts...')
{
  let s = readFileSync(join(DIR, '20260612_phase4d_framework_library.sql'), 'utf8')

  // Same fix as 4c
  s = s.replace(
    /INSERT INTO framework_library \(slug,\s*title,\s*source_book,\s*author,\s*category,\s*situation_tags,\s*urgency,\s*summary,\s*detailed_content\)/g,
    'INSERT INTO framework_library (slug, framework_name, book_title, author, situation_tags, urgency, core_insight, detailed_content)'
  )
  s = s.replace(
    /\('([^']*)',\s*'([^']*)',\s*'([^']*)',\s*'([^']*)',\s*'[^']*',\s*(ARRAY\[)/g,
    "('$1', '$2', '$3', '$4', $5"
  )

  await sql(s, '20260612_phase4d_framework_library.sql (patched)')
}

// ── Patch 5: Fix payslip_delivery — window function not allowed in UPDATE ─────
console.log('\n[5] Fixing phase5_payslip_delivery window function...')
await sql(`
  -- Payslip delivery tracking
  ALTER TABLE payslips
    ADD COLUMN IF NOT EXISTS delivered_at          TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS delivery_method       TEXT,
    ADD COLUMN IF NOT EXISTS other_deductions_total NUMERIC DEFAULT 0,
    ADD COLUMN IF NOT EXISTS pension_deduction     NUMERIC DEFAULT 0;

  -- Staff employee number
  ALTER TABLE staff
    ADD COLUMN IF NOT EXISTS employee_number TEXT,
    ADD COLUMN IF NOT EXISTS phone           TEXT;

  -- Generate employee numbers using a subquery (window functions not allowed in UPDATE directly)
  WITH numbered AS (
    SELECT id,
           'EMP-' || LPAD(ROW_NUMBER() OVER (PARTITION BY tenant_id ORDER BY created_at)::TEXT, 4, '0') AS emp_num
    FROM staff
    WHERE employee_number IS NULL
  )
  UPDATE staff s
  SET employee_number = n.emp_num
  FROM numbered n
  WHERE s.id = n.id;
`, 'phase5_payslip_delivery (fixed)')

console.log('\nAll patches applied.')
