-- 2026-10-26 — Bank payer aliases (Plan v2 step 9, learning from corrections).
--
-- Customers often pay from a personal or company account whose bank
-- description looks nothing like the name on the invoice ("J MOKOENA" paying
-- for "Jabu Trading"). When the owner matches such a line by hand, AdminOS
-- remembers "this payer description = that customer", so the next payment from
-- the same account is suggested without being asked again.
--
-- bank_transaction_id records which match taught it, so undoing that match
-- also forgets the lesson. Soft delete only. SERVICE ROLE ONLY, like the other
-- bank tables.

CREATE TABLE IF NOT EXISTS bank_payer_aliases (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  -- lib/bank/categorise.ts vendorKey() of the bank description.
  match_text           text NOT NULL CHECK (length(match_text) BETWEEN 4 AND 80),
  contact_name         text NOT NULL CHECK (length(contact_name) BETWEEN 1 AND 200),
  bank_transaction_id  uuid REFERENCES bank_transactions(id) ON DELETE SET NULL,
  created_by           uuid,
  created_at           timestamptz NOT NULL DEFAULT now(),
  deleted_at           timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS bank_payer_aliases_uq
  ON bank_payer_aliases (tenant_id, match_text) WHERE deleted_at IS NULL;

ALTER TABLE bank_payer_aliases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON bank_payer_aliases FROM PUBLIC, anon, authenticated;
