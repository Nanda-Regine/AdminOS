-- Audit trail — collapse the phantom `audit_logs` into canonical `audit_log`
-- 2026-07-17 · Mirembe Muse (Pty) Ltd
--
-- The codebase writes audit records through writeAuditLog() into `audit_log`
-- (singular) — the immutable, append-only, POPIA table. Two code paths instead
-- wrote/read `audit_logs` (plural), a table no migration ever creates. Those
-- writes were silently dropped. The code is fixed to use `audit_log`; this
-- migration cleans up the DB side.
--
-- Defensive and idempotent: if `audit_logs` was never created (the likely case),
-- everything here is a no-op. If it does exist (e.g. hand-created), any rows are
-- copied into `audit_log` before it is dropped, so no history is lost.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'audit_logs'
  ) THEN
    -- Copy across only the columns audit_log actually has; ignore any extras.
    INSERT INTO audit_log (tenant_id, actor, action, resource_type, resource_id, metadata, ip_address, created_at)
    SELECT
      tenant_id,
      actor::text,
      action,
      resource_type,
      resource_id,
      metadata,
      NULL::inet,               -- audit_logs had no ip column; leave null
      COALESCE(created_at, now())
    FROM audit_logs;

    DROP TABLE audit_logs;
    RAISE NOTICE 'audit_logs merged into audit_log and dropped';
  ELSE
    RAISE NOTICE 'audit_logs does not exist — nothing to merge (expected)';
  END IF;
END $$;

-- Verification — expect the plural table to be gone:
--   SELECT to_regclass('public.audit_logs');   -- should be NULL
--   SELECT to_regclass('public.audit_log');     -- should be non-NULL
