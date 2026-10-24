-- 2026-10-24 — Bank statement import + reconciliation.
--
-- Three NEW tables, nothing existing is altered:
--   bank_statement_imports   one row per uploaded CSV (audit trail: who, what, how many lines)
--   bank_transactions        every statement line, signed, deduplicated per tenant
--   bank_category_rules      "this vendor is always that category" — learned from the owner's corrections
--
-- Access model: SERVICE ROLE ONLY, like the other financial tables after the
-- Oct 2026 RLS sweep. Bank lines carry counterparties and balances, so the
-- public anon key plus a member's JWT must never reach them. RLS is enabled
-- with no policies for anon/authenticated, and every grant is revoked. All
-- reads and writes go through app/api/bank/* (withRoute, role-checked,
-- tenant-scoped) via supabaseAdmin.
--
-- Soft delete only (deleted_at). Timestamps are UTC (timestamptz); occurred_on
-- is a SAST calendar date as printed on the statement.

CREATE TABLE IF NOT EXISTS bank_statement_imports (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  filename           text NOT NULL,
  row_count          integer NOT NULL CHECK (row_count >= 0),
  imported_count     integer NOT NULL CHECK (imported_count >= 0),
  duplicate_count    integer NOT NULL DEFAULT 0 CHECK (duplicate_count >= 0),
  skipped_count      integer NOT NULL DEFAULT 0 CHECK (skipped_count >= 0),
  period_start       date,
  period_end         date,
  imported_by        uuid,
  created_at         timestamptz NOT NULL DEFAULT now(),
  deleted_at         timestamptz
);

CREATE TABLE IF NOT EXISTS bank_transactions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  import_id           uuid REFERENCES bank_statement_imports(id) ON DELETE SET NULL,
  occurred_on         date NOT NULL,
  description         text NOT NULL,
  -- Signed rands: positive = money in, negative = money out.
  amount              numeric(14,2) NOT NULL CHECK (amount <> 0),
  balance             numeric(14,2),
  -- A chart_of_accounts key (lib/finance/chartOfAccounts.ts); validated in the API,
  -- not a CHECK, because the chart is a code-owned list.
  category            text,
  category_source     text CHECK (category_source IN ('builtin', 'tenant_rule', 'manual')),
  match_status        text NOT NULL DEFAULT 'unmatched' CHECK (match_status IN ('unmatched', 'matched', 'ignored')),
  matched_invoice_id  uuid REFERENCES invoices(id) ON DELETE SET NULL,
  matched_at          timestamptz,
  matched_by          uuid,
  -- sha256 over tenant + date + amount + balance + normalised description + occurrence index,
  -- so re-uploading an overlapping statement never double-counts a line.
  dedupe_hash         text NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  deleted_at          timestamptz,
  CONSTRAINT bank_tx_matched_has_invoice CHECK (match_status <> 'matched' OR matched_invoice_id IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS bank_transactions_dedupe_uq
  ON bank_transactions (tenant_id, dedupe_hash) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS bank_transactions_tenant_date_idx
  ON bank_transactions (tenant_id, occurred_on DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS bank_transactions_unmatched_idx
  ON bank_transactions (tenant_id, match_status) WHERE deleted_at IS NULL AND match_status = 'unmatched';
-- One bank line per invoice payment: an invoice can be matched by several part-payments,
-- but a single bank line can only ever settle one invoice (enforced by the single FK column).
CREATE INDEX IF NOT EXISTS bank_transactions_invoice_idx
  ON bank_transactions (matched_invoice_id) WHERE matched_invoice_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS bank_category_rules (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  -- lib/bank/categorise.ts vendorKey(): lower-case vendor words, bank boilerplate stripped.
  match_text  text NOT NULL CHECK (length(match_text) BETWEEN 2 AND 80),
  direction   text NOT NULL CHECK (direction IN ('in', 'out')),
  category    text NOT NULL,
  created_by  uuid,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS bank_category_rules_uq
  ON bank_category_rules (tenant_id, direction, match_text) WHERE deleted_at IS NULL;

-- Service role only.
ALTER TABLE bank_statement_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_transactions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_category_rules    ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON bank_statement_imports FROM PUBLIC, anon, authenticated;
REVOKE ALL ON bank_transactions      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON bank_category_rules    FROM PUBLIC, anon, authenticated;
