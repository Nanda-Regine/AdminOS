-- 2026-10-26 — Invoice payments ledger (Plan v2 step 5).
--
-- Until now an invoice only carried a running `amount_paid`: no record of WHEN
-- each rand arrived, by what route, or which bank line paid it. That made two
-- things impossible: undoing a mistaken bank match, and learning how each
-- customer actually pays (median days late) for the cashflow forecast.
--
-- One NEW table, nothing existing is altered. Append-only in spirit: a reversal
-- is a second row with a negative amount that points at the original
-- (reverses_id) — rows are never edited or deleted. invoices.amount_paid stays
-- the source of truth for "what is owed"; this ledger is the history behind it.
--
-- Access: SERVICE ROLE ONLY (like bank_transactions). Reads and writes go
-- through lib/invoices/ledger.ts via supabaseAdmin, tenant-scoped.
-- Timestamps UTC; paid_on is the SAST calendar date the money arrived.

CREATE TABLE IF NOT EXISTS invoice_payments (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  invoice_id           uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  -- Signed rands: positive = money received, negative = a reversal or downward correction.
  amount               numeric(14,2) NOT NULL CHECK (amount <> 0),
  paid_on              date NOT NULL,
  method               text,
  source               text NOT NULL CHECK (source IN ('manual', 'bank', 'cash_sale', 'status_paid', 'correction', 'reversal', 'backfill')),
  bank_transaction_id  uuid REFERENCES bank_transactions(id) ON DELETE SET NULL,
  reverses_id          uuid REFERENCES invoice_payments(id) ON DELETE RESTRICT,
  created_by           uuid,
  created_at           timestamptz NOT NULL DEFAULT now(),
  deleted_at           timestamptz,
  CONSTRAINT invoice_payments_reversal_negative CHECK (reverses_id IS NULL OR amount < 0)
);

CREATE INDEX IF NOT EXISTS invoice_payments_invoice_idx
  ON invoice_payments (invoice_id, paid_on);
CREATE INDEX IF NOT EXISTS invoice_payments_tenant_date_idx
  ON invoice_payments (tenant_id, paid_on DESC) WHERE deleted_at IS NULL;
-- A payment can be reversed once, and a bank line can fund one payment at a time.
CREATE UNIQUE INDEX IF NOT EXISTS invoice_payments_reversed_once_uq
  ON invoice_payments (reverses_id) WHERE reverses_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS invoice_payments_bank_line_uq
  ON invoice_payments (bank_transaction_id) WHERE source = 'bank' AND reverses_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS invoice_payments_backfill_uq
  ON invoice_payments (invoice_id) WHERE source = 'backfill';

ALTER TABLE invoice_payments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON invoice_payments FROM PUBLIC, anon, authenticated;

-- Backfill: one opening row per invoice that already has money against it, dated
-- when it was marked paid (else when it was created). Idempotent via the unique index.
INSERT INTO invoice_payments (tenant_id, invoice_id, amount, paid_on, method, source)
SELECT i.tenant_id,
       i.id,
       i.amount_paid,
       (COALESCE(i.paid_at, i.created_at) AT TIME ZONE 'Africa/Johannesburg')::date,
       i.payment_method,
       'backfill'
FROM invoices i
WHERE i.deleted_at IS NULL
  AND COALESCE(i.amount_paid, 0) > 0
ON CONFLICT DO NOTHING;
