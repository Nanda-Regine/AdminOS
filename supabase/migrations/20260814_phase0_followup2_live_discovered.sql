-- Phase 0 follow-up #2 — 17 more policies discovered via live pg_policies query
-- (not present in the 6 migration files checked in the first follow-up pass)
-- Generated 2026-08-14 directly from production pg_policies definitions.

BEGIN;

DROP POLICY IF EXISTS "ai_cost_budgets_owner_read" ON ai_cost_budgets;
CREATE POLICY "ai_cost_budgets_owner_read" ON ai_cost_budgets FOR SELECT 
  USING (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS "ai_usage_tenant_read" ON ai_usage_logs;
CREATE POLICY "ai_usage_tenant_read" ON ai_usage_logs FOR SELECT 
  USING (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS "announcements_tenant" ON announcements;
CREATE POLICY "announcements_tenant" ON announcements 
  USING (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation" ON board_packs;
CREATE POLICY "tenant_isolation" ON board_packs 
  USING (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS "health_snapshots_tenant" ON business_health_snapshots;
CREATE POLICY "health_snapshots_tenant" ON business_health_snapshots 
  USING (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS "Tenant isolation on calendar_events" ON calendar_events;
CREATE POLICY "Tenant isolation on calendar_events" ON calendar_events 
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS "clock_events_tenant" ON clock_events;
CREATE POLICY "clock_events_tenant" ON clock_events 
  USING (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS "disciplinary_tenant" ON disciplinary_records;
CREATE POLICY "disciplinary_tenant" ON disciplinary_records 
  USING (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS "Tenant isolation on document_templates" ON document_templates;
CREATE POLICY "Tenant isolation on document_templates" ON document_templates 
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS "Tenant isolation on email_drafts" ON email_drafts;
CREATE POLICY "Tenant isolation on email_drafts" ON email_drafts 
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS "expenses_tenant" ON expenses;
CREATE POLICY "expenses_tenant" ON expenses 
  USING (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS "performance_reviews_tenant" ON performance_reviews;
CREATE POLICY "performance_reviews_tenant" ON performance_reviews 
  USING (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS "roles_tenant_isolation" ON roles;
CREATE POLICY "roles_tenant_isolation" ON roles 
  USING (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS "shifts_tenant" ON shifts;
CREATE POLICY "shifts_tenant" ON shifts 
  USING (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS "Tenants read own subscription" ON subscriptions;
CREATE POLICY "Tenants read own subscription" ON subscriptions FOR SELECT 
  USING (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS "user_roles_tenant_isolation" ON user_roles;
CREATE POLICY "user_roles_tenant_isolation" ON user_roles 
  USING (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS "Tenants read own workflow queue" ON workflow_queue;
CREATE POLICY "Tenants read own workflow queue" ON workflow_queue FOR SELECT 
  USING (tenant_id = current_tenant_id());

COMMIT;
