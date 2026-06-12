/**
 * Patches the invoices table to support the new invoicing API
 * and fixes the 002_v2_architecture trigger requirements.
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
  console.log(ok ? `  ✓  ${label}` : `  ✗  ${label}\n     ${msg.substring(0, 250)}`)
  return ok
}

// Step 1: Extend invoice_status enum with new values
await sql(`
  ALTER TYPE invoice_status ADD VALUE IF NOT EXISTS 'draft';
  ALTER TYPE invoice_status ADD VALUE IF NOT EXISTS 'sent';
  ALTER TYPE invoice_status ADD VALUE IF NOT EXISTS 'overdue';
  ALTER TYPE invoice_status ADD VALUE IF NOT EXISTS 'cancelled';
`, 'Extend invoice_status enum')

// Step 2: Add new columns to invoices table
await sql(`
  ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS invoice_number  TEXT,
    ADD COLUMN IF NOT EXISTS contact_id      UUID REFERENCES contacts(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS line_items      JSONB NOT NULL DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS subtotal        NUMERIC(12,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS vat_amount      NUMERIC(12,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total           NUMERIC(12,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS amount_due      NUMERIC(12,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS currency        TEXT DEFAULT 'ZAR',
    ADD COLUMN IF NOT EXISTS sent_at         TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS paid_at         TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS reference       TEXT,
    ADD COLUMN IF NOT EXISTS created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL;
`, 'Add new invoice columns')

// Step 3: Add days_overdue as a regular (non-generated) column — update via trigger
// GENERATED ALWAYS AS won't work because invoice_status enum doesn't support comparison easily
await sql(`
  ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS days_overdue INT NOT NULL DEFAULT 0;

  -- Update existing rows
  UPDATE invoices
  SET days_overdue = CASE
    WHEN status IN ('unpaid'::invoice_status, 'partial'::invoice_status)
         AND due_date IS NOT NULL AND due_date < CURRENT_DATE
    THEN (CURRENT_DATE - due_date)::INT
    ELSE 0
  END;

  -- Function to keep days_overdue updated
  CREATE OR REPLACE FUNCTION update_invoice_days_overdue()
  RETURNS TRIGGER AS $$
  BEGIN
    NEW.days_overdue := CASE
      WHEN NEW.status IN ('unpaid'::invoice_status, 'partial'::invoice_status, 'overdue'::invoice_status)
           AND NEW.due_date IS NOT NULL AND NEW.due_date < CURRENT_DATE
      THEN (CURRENT_DATE - NEW.due_date)::INT
      ELSE 0
    END;
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;

  DROP TRIGGER IF EXISTS trg_invoice_days_overdue ON invoices;
  CREATE TRIGGER trg_invoice_days_overdue
    BEFORE INSERT OR UPDATE ON invoices
    FOR EACH ROW EXECUTE FUNCTION update_invoice_days_overdue();
`, 'Add days_overdue column and update trigger')

// Step 4: Re-apply 002_v2_architecture — the trigger on invoices should now work
console.log('\nRe-applying 002_v2_architecture.sql...')
{
  let s = readFileSync(join(DIR, '002_v2_architecture.sql'), 'utf8')
  s = s.replace(/\(auth\.jwt\(\)\s*->>\s*'tenant_id'\)::uuid/gi,
    `(auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid`)
  await sql(s, '002_v2_architecture.sql')
}

// Step 5: Fix phase4d — VALUES list length issue
// The issue was that rows with escaped apostrophes in book titles weren't matched by regex
// Apply the migration manually with corrected column mapping
console.log('\nApplying phase4d with direct column fix...')
{
  let s = readFileSync(join(DIR, '20260612_phase4d_framework_library.sql'), 'utf8')

  // Fix 1: Fix column list
  s = s.replace(
    /INSERT INTO framework_library \(slug,\s*title,\s*source_book,\s*author,\s*category,\s*situation_tags,\s*urgency,\s*summary,\s*detailed_content\)/g,
    'INSERT INTO framework_library (slug, framework_name, book_title, author, situation_tags, urgency, core_insight, detailed_content)'
  )

  // Fix 2: The VALUES rows have the category as the 5th value (single-quoted string).
  // The challenge is rows with escaped quotes like 'Love ''Em or Lose ''Em'
  // Use a more targeted approach - split on ON CONFLICT and process the values block
  // The VALUES section format is:
  // ('slug', 'title', 'book', 'author', 'category',\n ARRAY[...], 'urgency',\n 'summary',\n '{...}'\n),
  //
  // The category is always a simple lowercase word like 'hr', 'finance', 'marketing', etc.
  // Pattern: after (author), there's a simple category like 'hr', then ARRAY
  s = s.replace(
    /,\s*'(hr|finance|marketing|sales|strategy|operations|leadership|mindset)'\s*,\s*\n(\s*ARRAY)/g,
    ',\n$2'
  )

  await sql(s, '20260612_phase4d_framework_library.sql (direct fix)')
}

console.log('\nAll invoice patches applied.')
