-- Migration: Schema bugfixes found in production audit
-- Fixes missing columns in invoices, contacts; clarifies staff.active field

-- ── invoices table: add missing financial columns ────────────────────────────
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS invoice_number   TEXT,
  ADD COLUMN IF NOT EXISTS contact_id       UUID REFERENCES contacts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS line_items       JSONB        DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS subtotal         NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS vat_amount       NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS total            NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS amount_due       NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS currency         TEXT         DEFAULT 'ZAR',
  ADD COLUMN IF NOT EXISTS created_by       UUID         REFERENCES auth.users(id) ON DELETE SET NULL;

-- Back-fill total from existing amount column where null
UPDATE invoices SET total = amount WHERE total IS NULL AND amount IS NOT NULL;
UPDATE invoices SET amount_due = amount - COALESCE(amount_paid, 0) WHERE amount_due IS NULL;

-- ── contacts table: add source column ───────────────────────────────────────
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS source TEXT;

-- ── staff table: ensure leave_taken column exists ────────────────────────────
ALTER TABLE staff
  ADD COLUMN IF NOT EXISTS leave_taken   INTEGER NOT NULL DEFAULT 0;

-- ── leave_requests table: add approval tracking ──────────────────────────────
ALTER TABLE leave_requests
  ADD COLUMN IF NOT EXISTS approved_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at  TIMESTAMPTZ;

-- ── products table: ensure all expected columns exist ────────────────────────
-- The inventory page now queries 'products' table with these columns
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS unit         TEXT,
  ADD COLUMN IF NOT EXISTS reorder_level INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_stock INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cost_price   NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS unit_price   NUMERIC(12,2);
