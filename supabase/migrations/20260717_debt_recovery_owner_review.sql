-- Debt recovery: owner review gate
-- 2026-07-17
--
-- AdminOS drafts payment reminders; the business owner decides anything beyond a
-- courteous factual reminder (tier 3) and sends it under their own name. This column
-- records that a reminder is waiting on that decision.
--
-- Context: automated escalation past tier 3 — especially anything referencing legal
-- action — would make AdminOS a party conducting collection on another's behalf for
-- reward. See inngest/functions/debtRecovery.ts:AUTO_SEND_MAX_TIER.

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS recovery_status text
  CHECK (recovery_status IN ('auto', 'awaiting_owner_review', 'owner_approved', 'paused'));

COMMENT ON COLUMN invoices.recovery_status IS
  'Null/auto = tiers 1-3 send automatically. awaiting_owner_review = escalation drafted, needs the owner to review and send. paused = owner stopped recovery on this invoice (e.g. debt disputed or under arrangement).';

-- Invoices whose recovery the owner has paused must never be picked up again by the
-- daily sweep. Partial index keeps the cron's scan cheap.
CREATE INDEX IF NOT EXISTS idx_invoices_recovery_review
  ON invoices (tenant_id, recovery_status)
  WHERE recovery_status IN ('awaiting_owner_review', 'paused');
