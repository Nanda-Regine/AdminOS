-- Phase 0.7 — Solo / Team Mode Toggle
-- Solo mode hides all staff/HR/Employee OS sections for single operators

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'solo'
    CHECK (mode IN ('solo', 'team'));

COMMENT ON COLUMN tenants.mode IS
  'solo = single operator (hides staff/HR UI); team = multiple employees';

-- Existing tenants with staff already added should be in team mode
UPDATE tenants t
SET mode = 'team'
WHERE EXISTS (
  SELECT 1 FROM staff s WHERE s.tenant_id = t.id LIMIT 1
);
