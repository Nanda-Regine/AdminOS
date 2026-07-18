-- Scale prep — tenant-leading indexes on hot paths that lacked them
-- 2026-07-18 · Mirembe Muse (Pty) Ltd
--
-- Almost every dashboard query and the AI budget check filter by tenant_id (and
-- often status / created_at), but several hot tables only had non-tenant indexes
-- (e.g. invoices had status + due_date but no tenant_id-leading index), so those
-- reads planned as scans. At current data volume it doesn't bite; these make the
-- common access patterns index-backed before it does.
--
-- IF NOT EXISTS = idempotent. Instant at current volume. At large scale, rebuild
-- these with CREATE INDEX CONCURRENTLY (cannot run inside a txn) to avoid locks.

-- Dashboard invoice lists: WHERE tenant_id = ? (+ status filters), ORDER BY.
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_status
  ON invoices (tenant_id, status);

-- Inbox / conversation lists: WHERE tenant_id = ? AND status = ?
CREATE INDEX IF NOT EXISTS idx_conversations_tenant_status
  ON conversations (tenant_id, status);

-- AI budget check runs on every agent call: sum tokens WHERE tenant_id = ?
-- AND created_at >= start-of-day. This is the hottest read in the AI path.
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_tenant_created
  ON ai_usage_logs (tenant_id, created_at);

-- Verification:
--   SELECT indexname FROM pg_indexes WHERE schemaname='public'
--   AND indexname IN ('idx_invoices_tenant_status','idx_conversations_tenant_status','idx_ai_usage_logs_tenant_created');
