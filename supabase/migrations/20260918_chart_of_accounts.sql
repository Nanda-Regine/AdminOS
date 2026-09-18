-- Chart-of-accounts categorization + cash-sale support on invoices.
-- Invoices currently have zero income categorization (unlike expenses,
-- which already have a `category` column) — buildIncomeStatement() can
-- only show one lump "Sales revenue" line. `channel` distinguishes an
-- instant Quick Sale entry from a normal sent-then-collected invoice for
-- reporting; `payment_method` is the same kind of structure SA SMEs
-- already track by hand (cash/card/EFT/mobile money).
--
-- Categories are validated at the application layer against
-- lib/finance/chartOfAccounts.ts, not a DB CHECK constraint, so the list
-- can grow without a migration (same approach already used for
-- expenses.category).

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS category        TEXT DEFAULT 'sales',
  ADD COLUMN IF NOT EXISTS channel         TEXT DEFAULT 'invoice',
  ADD COLUMN IF NOT EXISTS payment_method  TEXT;

UPDATE invoices SET category = 'sales'   WHERE category IS NULL;
UPDATE invoices SET channel  = 'invoice' WHERE channel  IS NULL;
