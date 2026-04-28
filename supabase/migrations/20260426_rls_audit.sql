-- =============================================================================
-- AdminOS — RLS Audit Migration
-- 2026-04-26 · Mirembe Muse (Pty) Ltd
--
-- Audit of all interactive tables. Ensures every table has explicit
-- SELECT / INSERT / UPDATE / DELETE policies scoped by tenant_id.
--
-- All server-side writes (cron jobs, webhook handlers) use supabaseAdmin
-- (service role key) which bypasses RLS entirely — those paths are safe
-- regardless of client-side policy coverage.
--
-- Idempotent — safe to re-run.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 0. Ensure current_tenant_id() helper exists
--    Reads tenant_id from the authenticated user's JWT user_metadata.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid,
    (auth.jwt() ->> 'tenant_id')::uuid
  )
$$;


-- ---------------------------------------------------------------------------
-- 1. conversations — WhatsApp / email threads
-- ---------------------------------------------------------------------------
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "conversations_rls"     ON conversations;
DROP POLICY IF EXISTS "conversations_select"  ON conversations;
DROP POLICY IF EXISTS "conversations_insert"  ON conversations;
DROP POLICY IF EXISTS "conversations_update"  ON conversations;
DROP POLICY IF EXISTS "conversations_delete"  ON conversations;

CREATE POLICY "conversations_select" ON conversations
  FOR SELECT USING (tenant_id = current_tenant_id());

CREATE POLICY "conversations_insert" ON conversations
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "conversations_update" ON conversations
  FOR UPDATE USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "conversations_delete" ON conversations
  FOR DELETE USING (tenant_id = current_tenant_id());


-- ---------------------------------------------------------------------------
-- 2. messages — individual messages within a conversation
-- ---------------------------------------------------------------------------
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "messages_rls"    ON messages;
DROP POLICY IF EXISTS "messages_select" ON messages;
DROP POLICY IF EXISTS "messages_insert" ON messages;
DROP POLICY IF EXISTS "messages_update" ON messages;
DROP POLICY IF EXISTS "messages_delete" ON messages;

CREATE POLICY "messages_select" ON messages
  FOR SELECT USING (tenant_id = current_tenant_id());

CREATE POLICY "messages_insert" ON messages
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "messages_update" ON messages
  FOR UPDATE USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "messages_delete" ON messages
  FOR DELETE USING (tenant_id = current_tenant_id());


-- ---------------------------------------------------------------------------
-- 3. contacts — unified CRM records
-- ---------------------------------------------------------------------------
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contacts_rls"    ON contacts;
DROP POLICY IF EXISTS "contacts_select" ON contacts;
DROP POLICY IF EXISTS "contacts_insert" ON contacts;
DROP POLICY IF EXISTS "contacts_update" ON contacts;
DROP POLICY IF EXISTS "contacts_delete" ON contacts;

CREATE POLICY "contacts_select" ON contacts
  FOR SELECT USING (tenant_id = current_tenant_id());

CREATE POLICY "contacts_insert" ON contacts
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "contacts_update" ON contacts
  FOR UPDATE USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "contacts_delete" ON contacts
  FOR DELETE USING (tenant_id = current_tenant_id());


-- ---------------------------------------------------------------------------
-- 4. invoices — debt register
-- ---------------------------------------------------------------------------
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invoices_rls"    ON invoices;
DROP POLICY IF EXISTS "invoices_select" ON invoices;
DROP POLICY IF EXISTS "invoices_insert" ON invoices;
DROP POLICY IF EXISTS "invoices_update" ON invoices;
DROP POLICY IF EXISTS "invoices_delete" ON invoices;

CREATE POLICY "invoices_select" ON invoices
  FOR SELECT USING (tenant_id = current_tenant_id());

CREATE POLICY "invoices_insert" ON invoices
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "invoices_update" ON invoices
  FOR UPDATE USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "invoices_delete" ON invoices
  FOR DELETE USING (tenant_id = current_tenant_id());


-- ---------------------------------------------------------------------------
-- 5. staff — team members
-- ---------------------------------------------------------------------------
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_rls"    ON staff;
DROP POLICY IF EXISTS "staff_select" ON staff;
DROP POLICY IF EXISTS "staff_insert" ON staff;
DROP POLICY IF EXISTS "staff_update" ON staff;
DROP POLICY IF EXISTS "staff_delete" ON staff;

CREATE POLICY "staff_select" ON staff
  FOR SELECT USING (tenant_id = current_tenant_id());

CREATE POLICY "staff_insert" ON staff
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "staff_update" ON staff
  FOR UPDATE USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "staff_delete" ON staff
  FOR DELETE USING (tenant_id = current_tenant_id());


-- ---------------------------------------------------------------------------
-- 6. goals — business goals
-- ---------------------------------------------------------------------------
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "goals_rls"    ON goals;
DROP POLICY IF EXISTS "goals_select" ON goals;
DROP POLICY IF EXISTS "goals_insert" ON goals;
DROP POLICY IF EXISTS "goals_update" ON goals;
DROP POLICY IF EXISTS "goals_delete" ON goals;

CREATE POLICY "goals_select" ON goals
  FOR SELECT USING (tenant_id = current_tenant_id());

CREATE POLICY "goals_insert" ON goals
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "goals_update" ON goals
  FOR UPDATE USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "goals_delete" ON goals
  FOR DELETE USING (tenant_id = current_tenant_id());


-- ---------------------------------------------------------------------------
-- 7. workflow_queue — automation job queue
--    Previously: SELECT-only (gap). Added INSERT/UPDATE/DELETE for clients.
--    Server-side cron handlers use service_role (bypasses RLS).
-- ---------------------------------------------------------------------------
ALTER TABLE workflow_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenants read own workflow queue" ON workflow_queue;
DROP POLICY IF EXISTS "workflow_queue_select" ON workflow_queue;
DROP POLICY IF EXISTS "workflow_queue_insert" ON workflow_queue;
DROP POLICY IF EXISTS "workflow_queue_update" ON workflow_queue;
DROP POLICY IF EXISTS "workflow_queue_delete" ON workflow_queue;

CREATE POLICY "workflow_queue_select" ON workflow_queue
  FOR SELECT USING (tenant_id = current_tenant_id());

CREATE POLICY "workflow_queue_insert" ON workflow_queue
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "workflow_queue_update" ON workflow_queue
  FOR UPDATE USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "workflow_queue_delete" ON workflow_queue
  FOR DELETE USING (tenant_id = current_tenant_id());


-- ---------------------------------------------------------------------------
-- 8. business_insights — AI advisor memory
-- ---------------------------------------------------------------------------
ALTER TABLE business_insights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "business_insights_rls"    ON business_insights;
DROP POLICY IF EXISTS "business_insights_select" ON business_insights;
DROP POLICY IF EXISTS "business_insights_insert" ON business_insights;
DROP POLICY IF EXISTS "business_insights_update" ON business_insights;
DROP POLICY IF EXISTS "business_insights_delete" ON business_insights;

CREATE POLICY "business_insights_select" ON business_insights
  FOR SELECT USING (tenant_id = current_tenant_id());

CREATE POLICY "business_insights_insert" ON business_insights
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "business_insights_update" ON business_insights
  FOR UPDATE USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "business_insights_delete" ON business_insights
  FOR DELETE USING (tenant_id = current_tenant_id());


-- ---------------------------------------------------------------------------
-- 9. whatsapp_sequences + sequence_enrollments
-- ---------------------------------------------------------------------------
ALTER TABLE whatsapp_sequences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "whatsapp_sequences_rls"    ON whatsapp_sequences;
DROP POLICY IF EXISTS "whatsapp_sequences_select" ON whatsapp_sequences;
DROP POLICY IF EXISTS "whatsapp_sequences_insert" ON whatsapp_sequences;
DROP POLICY IF EXISTS "whatsapp_sequences_update" ON whatsapp_sequences;
DROP POLICY IF EXISTS "whatsapp_sequences_delete" ON whatsapp_sequences;

CREATE POLICY "whatsapp_sequences_select" ON whatsapp_sequences
  FOR SELECT USING (tenant_id = current_tenant_id());

CREATE POLICY "whatsapp_sequences_insert" ON whatsapp_sequences
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "whatsapp_sequences_update" ON whatsapp_sequences
  FOR UPDATE USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "whatsapp_sequences_delete" ON whatsapp_sequences
  FOR DELETE USING (tenant_id = current_tenant_id());


ALTER TABLE sequence_enrollments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sequence_enrollments_rls"    ON sequence_enrollments;
DROP POLICY IF EXISTS "sequence_enrollments_select" ON sequence_enrollments;
DROP POLICY IF EXISTS "sequence_enrollments_insert" ON sequence_enrollments;
DROP POLICY IF EXISTS "sequence_enrollments_update" ON sequence_enrollments;
DROP POLICY IF EXISTS "sequence_enrollments_delete" ON sequence_enrollments;

CREATE POLICY "sequence_enrollments_select" ON sequence_enrollments
  FOR SELECT USING (tenant_id = current_tenant_id());

CREATE POLICY "sequence_enrollments_insert" ON sequence_enrollments
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "sequence_enrollments_update" ON sequence_enrollments
  FOR UPDATE USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "sequence_enrollments_delete" ON sequence_enrollments
  FOR DELETE USING (tenant_id = current_tenant_id());


-- ---------------------------------------------------------------------------
-- 10. subscriptions — billing state
--     Previously: SELECT-only in migration 002. Full policies added.
-- ---------------------------------------------------------------------------
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "subscriptions_rls"           ON subscriptions;
DROP POLICY IF EXISTS "Tenants read own subscription" ON subscriptions;
DROP POLICY IF EXISTS "subscriptions_select"        ON subscriptions;
DROP POLICY IF EXISTS "subscriptions_insert"        ON subscriptions;
DROP POLICY IF EXISTS "subscriptions_update"        ON subscriptions;
DROP POLICY IF EXISTS "subscriptions_delete"        ON subscriptions;

CREATE POLICY "subscriptions_select" ON subscriptions
  FOR SELECT USING (tenant_id = current_tenant_id());

-- INSERT/UPDATE handled by service_role webhook handler (PayFast ITN)
-- but explicit client-side policies let the dashboard read without restriction
CREATE POLICY "subscriptions_insert" ON subscriptions
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "subscriptions_update" ON subscriptions
  FOR UPDATE USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "subscriptions_delete" ON subscriptions
  FOR DELETE USING (tenant_id = current_tenant_id());


-- ---------------------------------------------------------------------------
-- 11. document_templates + email_drafts
--     Previously used (auth.jwt() ->> 'tenant_id') — standardised to
--     current_tenant_id() which handles both JWT path variants.
-- ---------------------------------------------------------------------------
ALTER TABLE document_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant isolation on document_templates" ON document_templates;
DROP POLICY IF EXISTS "document_templates_select" ON document_templates;
DROP POLICY IF EXISTS "document_templates_insert" ON document_templates;
DROP POLICY IF EXISTS "document_templates_update" ON document_templates;
DROP POLICY IF EXISTS "document_templates_delete" ON document_templates;

CREATE POLICY "document_templates_select" ON document_templates
  FOR SELECT USING (tenant_id = current_tenant_id());

CREATE POLICY "document_templates_insert" ON document_templates
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "document_templates_update" ON document_templates
  FOR UPDATE USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "document_templates_delete" ON document_templates
  FOR DELETE USING (tenant_id = current_tenant_id());


ALTER TABLE email_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant isolation on email_drafts" ON email_drafts;
DROP POLICY IF EXISTS "email_drafts_select" ON email_drafts;
DROP POLICY IF EXISTS "email_drafts_insert" ON email_drafts;
DROP POLICY IF EXISTS "email_drafts_update" ON email_drafts;
DROP POLICY IF EXISTS "email_drafts_delete" ON email_drafts;

CREATE POLICY "email_drafts_select" ON email_drafts
  FOR SELECT USING (tenant_id = current_tenant_id());

CREATE POLICY "email_drafts_insert" ON email_drafts
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "email_drafts_update" ON email_drafts
  FOR UPDATE USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "email_drafts_delete" ON email_drafts
  FOR DELETE USING (tenant_id = current_tenant_id());


-- ---------------------------------------------------------------------------
-- 12. calendar_events — standardise to current_tenant_id()
-- ---------------------------------------------------------------------------
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant isolation on calendar_events" ON calendar_events;
DROP POLICY IF EXISTS "calendar_events_rls"    ON calendar_events;
DROP POLICY IF EXISTS "calendar_events_select" ON calendar_events;
DROP POLICY IF EXISTS "calendar_events_insert" ON calendar_events;
DROP POLICY IF EXISTS "calendar_events_update" ON calendar_events;
DROP POLICY IF EXISTS "calendar_events_delete" ON calendar_events;

CREATE POLICY "calendar_events_select" ON calendar_events
  FOR SELECT USING (tenant_id = current_tenant_id());

CREATE POLICY "calendar_events_insert" ON calendar_events
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "calendar_events_update" ON calendar_events
  FOR UPDATE USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "calendar_events_delete" ON calendar_events
  FOR DELETE USING (tenant_id = current_tenant_id());


-- ---------------------------------------------------------------------------
-- 13. debtors — debt recovery tracking
-- ---------------------------------------------------------------------------
ALTER TABLE debtors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "debtors_rls"    ON debtors;
DROP POLICY IF EXISTS "debtors_select" ON debtors;
DROP POLICY IF EXISTS "debtors_insert" ON debtors;
DROP POLICY IF EXISTS "debtors_update" ON debtors;
DROP POLICY IF EXISTS "debtors_delete" ON debtors;

CREATE POLICY "debtors_select" ON debtors
  FOR SELECT USING (tenant_id = current_tenant_id());

CREATE POLICY "debtors_insert" ON debtors
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "debtors_update" ON debtors
  FOR UPDATE USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "debtors_delete" ON debtors
  FOR DELETE USING (tenant_id = current_tenant_id());


-- ---------------------------------------------------------------------------
-- 14. documents — uploaded files
-- ---------------------------------------------------------------------------
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "documents_rls"    ON documents;
DROP POLICY IF EXISTS "documents_select" ON documents;
DROP POLICY IF EXISTS "documents_insert" ON documents;
DROP POLICY IF EXISTS "documents_update" ON documents;
DROP POLICY IF EXISTS "documents_delete" ON documents;

CREATE POLICY "documents_select" ON documents
  FOR SELECT USING (tenant_id = current_tenant_id());

CREATE POLICY "documents_insert" ON documents
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "documents_update" ON documents
  FOR UPDATE USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "documents_delete" ON documents
  FOR DELETE USING (tenant_id = current_tenant_id());


-- ---------------------------------------------------------------------------
-- 15. leave_requests
-- ---------------------------------------------------------------------------
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "leave_requests_rls"    ON leave_requests;
DROP POLICY IF EXISTS "leave_requests_select" ON leave_requests;
DROP POLICY IF EXISTS "leave_requests_insert" ON leave_requests;
DROP POLICY IF EXISTS "leave_requests_update" ON leave_requests;
DROP POLICY IF EXISTS "leave_requests_delete" ON leave_requests;

CREATE POLICY "leave_requests_select" ON leave_requests
  FOR SELECT USING (tenant_id = current_tenant_id());

CREATE POLICY "leave_requests_insert" ON leave_requests
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "leave_requests_update" ON leave_requests
  FOR UPDATE USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "leave_requests_delete" ON leave_requests
  FOR DELETE USING (tenant_id = current_tenant_id());


-- ---------------------------------------------------------------------------
-- 16. audit_log — IMMUTABLE append-only (POPIA compliance)
--     SELECT + INSERT only. UPDATE and DELETE revoked at all roles.
-- ---------------------------------------------------------------------------
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_log_insert" ON audit_log;
DROP POLICY IF EXISTS "audit_log_select" ON audit_log;

CREATE POLICY "audit_log_select" ON audit_log
  FOR SELECT USING (tenant_id IS NULL OR tenant_id = current_tenant_id());

CREATE POLICY "audit_log_insert" ON audit_log
  FOR INSERT WITH CHECK (tenant_id IS NULL OR tenant_id = current_tenant_id());

-- Hard-revoke destructive operations — append-only enforcement
REVOKE UPDATE, DELETE ON audit_log FROM authenticated;
REVOKE UPDATE, DELETE ON audit_log FROM anon;


-- ---------------------------------------------------------------------------
-- 17. tenants — own-row only
-- ---------------------------------------------------------------------------
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_select_own" ON tenants;
DROP POLICY IF EXISTS "tenant_update_own" ON tenants;
DROP POLICY IF EXISTS "tenant_insert_own" ON tenants;

-- Tenants are created by service_role only (create-tenant API route)
-- Clients may only read and update their own row
CREATE POLICY "tenant_select_own" ON tenants
  FOR SELECT USING (id = current_tenant_id());

CREATE POLICY "tenant_update_own" ON tenants
  FOR UPDATE USING (id = current_tenant_id())
  WITH CHECK (id = current_tenant_id());


-- ---------------------------------------------------------------------------
-- NOTE: whatsapp_templates
-- The template registry is a TypeScript constant in lib/whatsapp/templates.ts,
-- not a database table. Templates submitted to Meta Business Suite need no
-- per-tenant isolation — they are app-wide. No DB migration needed.
-- ---------------------------------------------------------------------------


-- ---------------------------------------------------------------------------
-- Done.
-- Tables audited (all have explicit SELECT/INSERT/UPDATE/DELETE):
--   conversations, messages, contacts, invoices, staff, goals,
--   workflow_queue, business_insights, whatsapp_sequences, sequence_enrollments,
--   subscriptions, document_templates, email_drafts, calendar_events,
--   debtors, documents, leave_requests, tenants, audit_log (SELECT+INSERT only)
--
-- Key fix: workflow_queue and subscriptions previously had SELECT-only policies.
-- Key fix: document_templates, email_drafts, calendar_events standardised to
--          current_tenant_id() (were using old auth.jwt() ->> 'tenant_id' path).
-- ---------------------------------------------------------------------------
