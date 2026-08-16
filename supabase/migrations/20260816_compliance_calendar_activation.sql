-- Activate the SA compliance calendar.
--
-- Phase 8 shipped compliance_items and a correct seed_compliance_calendar()
-- carrying EMP201 / IRP6 / ITR14 / CIPC / COIDA / EMP501 with real penalty text.
-- Nothing ever called it: no tenant-creation hook, no POST endpoint, no page.
-- Every tenant's calendar was permanently empty while the homepage sold it as
-- "pre-seeded". This migration makes it real.

-- ─── 1. Make seeding idempotent ──────────────────────────────────────────────
-- The seed function's ON CONFLICT DO NOTHING had no constraint to catch on, so
-- re-running it duplicated every row. Dedupe first, then add the constraint.

DELETE FROM compliance_items a USING compliance_items b
WHERE a.ctid < b.ctid
  AND a.tenant_id = b.tenant_id
  AND a.item_type = b.item_type
  AND a.due_date IS NOT DISTINCT FROM b.due_date;

CREATE UNIQUE INDEX IF NOT EXISTS compliance_items_tenant_type_due_key
  ON compliance_items (tenant_id, item_type, due_date);

-- ─── 2. Status is computed, never stale ──────────────────────────────────────
-- Ported from BB MotherShip Deluxe (010_world_class.sql): let the database
-- derive upcoming/due/overdue from due_date so status cannot drift no matter
-- what writes the row. Terminal states set by a human are never overwritten.

ALTER TABLE compliance_items
  ADD COLUMN IF NOT EXISTS alert_days_before INT NOT NULL DEFAULT 30;

CREATE OR REPLACE FUNCTION compliance_item_compute_status()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IN ('completed','not_applicable') THEN
    RETURN NEW;
  END IF;
  IF NEW.due_date IS NULL THEN
    NEW.status := 'upcoming';
  ELSIF NEW.due_date < CURRENT_DATE THEN
    NEW.status := 'overdue';
  ELSIF NEW.due_date <= CURRENT_DATE + (NEW.alert_days_before || ' days')::INTERVAL THEN
    NEW.status := 'due';
  ELSE
    NEW.status := 'upcoming';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS compliance_item_status_trg ON compliance_items;
CREATE TRIGGER compliance_item_status_trg
  BEFORE INSERT OR UPDATE OF due_date, alert_days_before, status ON compliance_items
  FOR EACH ROW EXECUTE FUNCTION compliance_item_compute_status();

-- ─── 3. Recurring items roll forward ─────────────────────────────────────────
-- `recurrence` existed as a column that nothing acted on, so a completed
-- monthly item simply vanished from the calendar. Completing one now schedules
-- the next occurrence.

CREATE OR REPLACE FUNCTION compliance_item_roll_forward()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_next DATE;
BEGIN
  IF NEW.status <> 'completed' OR OLD.status = 'completed' THEN RETURN NEW; END IF;
  IF NEW.recurrence IS NULL OR NEW.due_date IS NULL THEN RETURN NEW; END IF;

  v_next := CASE NEW.recurrence
    WHEN 'monthly'   THEN NEW.due_date + INTERVAL '1 month'
    WHEN 'bi-annual' THEN NEW.due_date + INTERVAL '6 months'
    WHEN 'annual'    THEN NEW.due_date + INTERVAL '1 year'
    WHEN 'quarterly' THEN NEW.due_date + INTERVAL '3 months'
    ELSE NULL
  END;
  IF v_next IS NULL THEN RETURN NEW; END IF;

  INSERT INTO compliance_items
    (tenant_id, item_type, title, description, due_date, recurrence,
     penalty_description, guidance_module, alert_days_before)
  VALUES
    (NEW.tenant_id, NEW.item_type, NEW.title, NEW.description, v_next, NEW.recurrence,
     NEW.penalty_description, NEW.guidance_module, NEW.alert_days_before)
  ON CONFLICT (tenant_id, item_type, due_date) DO NOTHING;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS compliance_item_roll_forward_trg ON compliance_items;
CREATE TRIGGER compliance_item_roll_forward_trg
  AFTER UPDATE OF status ON compliance_items
  FOR EACH ROW EXECUTE FUNCTION compliance_item_roll_forward();

-- ─── 4. Seed every existing tenant ───────────────────────────────────────────
-- New tenants are seeded by the onboarding route; this backfills the ones that
-- were created while the calendar was dead.

DO $$
DECLARE t RECORD;
BEGIN
  FOR t IN SELECT id FROM tenants WHERE active = TRUE LOOP
    PERFORM seed_compliance_calendar(t.id);
  END LOOP;
END $$;

-- Recompute status on the backfilled rows (the trigger fires on INSERT, but the
-- seed function's rows predate it for any tenant seeded earlier).
UPDATE compliance_items SET due_date = due_date
WHERE status NOT IN ('completed','not_applicable');

-- ─── 5. Match the Phase 0 write-lockdown ─────────────────────────────────────
-- All writes go through the service role; clients read only.
REVOKE INSERT, UPDATE, DELETE ON public.compliance_items FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.compliance_items FROM anon;
