-- =============================================================================
-- AdminOS v2 Architecture Migration
-- Run in Supabase SQL editor (idempotent — safe to re-run)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- A. WORKFLOW QUEUE — nerve centre for all automations
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS workflow_queue (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  workflow_type         text NOT NULL,
  payload               jsonb NOT NULL DEFAULT '{}',
  status                text NOT NULL DEFAULT 'pending',
  attempts              int NOT NULL DEFAULT 0,
  max_attempts          int NOT NULL DEFAULT 3,
  next_attempt_at       timestamptz NOT NULL DEFAULT now(),
  error                 text,
  processing_started_at timestamptz,
  completed_at          timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT valid_wq_status CHECK (
    status IN ('pending','processing','complete','failed','cancelled')
  ),
  CONSTRAINT valid_workflow_type CHECK (
    workflow_type IN (
      'debt_recovery_initiated', 'document_uploaded', 'wellness_due',
      'burnout_alert', 'brief_generate', 'trial_expiring',
      'contact_sentiment_low', 'xero_invoice_paid', 'subscription_activated',
      'subscription_cancelled', 'onboarding_sequence', 'escalation_due',
      'email_draft_requested', 'contract_expiry_alert', 'payroll_reminder'
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_wq_tenant_status ON workflow_queue(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_wq_next_attempt ON workflow_queue(next_attempt_at)
  WHERE status IN ('pending', 'failed');
CREATE INDEX IF NOT EXISTS idx_wq_type ON workflow_queue(workflow_type);

ALTER TABLE workflow_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenants read own workflow queue" ON workflow_queue;
CREATE POLICY "Tenants read own workflow queue"
  ON workflow_queue FOR SELECT
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- ---------------------------------------------------------------------------
-- B. DOCUMENT TEMPLATES — shadow documents (structure only, no PII values)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS document_templates (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  document_type    text NOT NULL,
  template_name    text NOT NULL,
  description      text,
  extracted_schema jsonb DEFAULT '{}',
  is_reference     boolean NOT NULL DEFAULT false,
  storage_path     text,
  file_type        text,
  status           text DEFAULT 'pending',
  ai_summary       text,
  processed_at     timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT valid_doc_template_type CHECK (
    document_type IN (
      'invoice','contract','sop','hr','strategy','report',
      'quote','payroll','compliance','correspondence','other'
    )
  )
);

ALTER TABLE document_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant isolation on document_templates" ON document_templates;
CREATE POLICY "Tenant isolation on document_templates"
  ON document_templates
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- ---------------------------------------------------------------------------
-- C. EMAIL DRAFTS — Pen agent outputs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS email_drafts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  email_type      text NOT NULL,
  category        text NOT NULL,
  subject         text NOT NULL,
  body            text NOT NULL,
  recipient_name  text,
  recipient_email text,
  context_type    text,
  context_id      uuid,
  tone_used       text,
  language_used   text DEFAULT 'en',
  data_sources    jsonb DEFAULT '[]',
  status          text NOT NULL DEFAULT 'draft',
  is_template     boolean NOT NULL DEFAULT false,
  template_name   text,
  sent_at         timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT valid_email_status CHECK (
    status IN ('draft','sent','saved_template','archived')
  )
);

CREATE INDEX IF NOT EXISTS idx_email_drafts_tenant ON email_drafts(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_email_drafts_type ON email_drafts(tenant_id, email_type);

ALTER TABLE email_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant isolation on email_drafts" ON email_drafts;
CREATE POLICY "Tenant isolation on email_drafts"
  ON email_drafts
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- ---------------------------------------------------------------------------
-- D. ENHANCE EXISTING TABLES
-- ---------------------------------------------------------------------------

-- Message delivery tracking
ALTER TABLE messages ADD COLUMN IF NOT EXISTS delivery_status text DEFAULT 'sent';
ALTER TABLE messages ADD COLUMN IF NOT EXISTS delivered_at timestamptz;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS read_at timestamptz;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS whatsapp_message_id text;

-- Document intelligence fields
ALTER TABLE documents ADD COLUMN IF NOT EXISTS is_reference boolean DEFAULT false;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS document_type text;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS extracted_data jsonb DEFAULT '{}';
ALTER TABLE documents ADD COLUMN IF NOT EXISTS expiry_date date;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS key_parties text[];
ALTER TABLE documents ADD COLUMN IF NOT EXISTS key_obligations text[];
ALTER TABLE documents ADD COLUMN IF NOT EXISTS recovery_tier int DEFAULT 0;

-- Invoices: recovery tracking
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS recovery_tier int DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS last_reminder_sent_at timestamptz;

-- Contacts: CRM enhancements (add if not already in schema)
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS company text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS total_invoiced numeric(12,2) DEFAULT 0;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS total_paid numeric(12,2) DEFAULT 0;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_contacted_at timestamptz;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS sentiment_score int;

-- Conversations: link to contacts
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS contact_id uuid REFERENCES contacts(id);

-- Calendar events table
CREATE TABLE IF NOT EXISTS calendar_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  title         text NOT NULL,
  description   text,
  event_type    text DEFAULT 'manual',
  start_at      timestamptz NOT NULL,
  end_at        timestamptz,
  all_day       boolean DEFAULT false,
  source_type   text,
  source_id     uuid,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_calendar_tenant ON calendar_events(tenant_id, start_at);

ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant isolation on calendar_events" ON calendar_events;
CREATE POLICY "Tenant isolation on calendar_events"
  ON calendar_events
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- Subscriptions table (billing state)
CREATE TABLE IF NOT EXISTS subscriptions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  plan          text NOT NULL DEFAULT 'trial',
  status        text NOT NULL DEFAULT 'trialing',
  trial_ends_at timestamptz,
  current_period_start timestamptz,
  current_period_end   timestamptz,
  payfast_token text,
  cancelled_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenants read own subscription" ON subscriptions;
CREATE POLICY "Tenants read own subscription"
  ON subscriptions FOR SELECT
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- ---------------------------------------------------------------------------
-- E. POSTGRES TRIGGERS — database-driven automation
-- ---------------------------------------------------------------------------

-- TRIGGER 1: Invoice becomes overdue → queue debt recovery
CREATE OR REPLACE FUNCTION fn_trigger_debt_recovery()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.days_overdue > 0 AND (OLD.days_overdue IS NULL OR OLD.days_overdue = 0) THEN
    INSERT INTO workflow_queue (tenant_id, workflow_type, payload)
    VALUES (
      NEW.tenant_id,
      'debt_recovery_initiated',
      jsonb_build_object(
        'invoice_id',        NEW.id,
        'contact_identifier', NEW.contact_phone,
        'amount',            NEW.amount,
        'days_overdue',      NEW.days_overdue,
        'invoice_reference', COALESCE(NEW.reference, NEW.id::text)
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_invoice_overdue ON invoices;
CREATE TRIGGER trg_invoice_overdue
  AFTER UPDATE OF days_overdue ON invoices
  FOR EACH ROW EXECUTE FUNCTION fn_trigger_debt_recovery();

-- TRIGGER 2: Document inserted with processing status → queue Doc pipeline
CREATE OR REPLACE FUNCTION fn_trigger_doc_pipeline()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'processing' THEN
    INSERT INTO workflow_queue (tenant_id, workflow_type, payload)
    VALUES (
      NEW.tenant_id,
      'document_uploaded',
      jsonb_build_object(
        'document_id',   NEW.id,
        'file_type',     COALESCE(NEW.file_type, 'unknown'),
        'storage_path',  NEW.storage_path,
        'is_reference',  COALESCE(NEW.is_reference, false)
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_document_processing ON documents;
CREATE TRIGGER trg_document_processing
  AFTER INSERT ON documents
  FOR EACH ROW EXECUTE FUNCTION fn_trigger_doc_pipeline();

-- TRIGGER 3: Staff wellness score drops → burnout alert (with 48h dedup)
CREATE OR REPLACE FUNCTION fn_trigger_burnout_alert()
RETURNS TRIGGER AS $$
DECLARE
  avg_score numeric;
  score_count int;
BEGIN
  IF NEW.wellness_scores IS NOT NULL AND jsonb_array_length(NEW.wellness_scores) >= 3 THEN
    SELECT AVG(val::text::numeric), COUNT(*)
    INTO avg_score, score_count
    FROM (
      SELECT jsonb_array_elements(NEW.wellness_scores) AS val
      LIMIT 7
    ) recent;

    IF avg_score < 2.5 THEN
      INSERT INTO workflow_queue (tenant_id, workflow_type, payload)
      SELECT
        NEW.tenant_id,
        'burnout_alert',
        jsonb_build_object(
          'staff_id',    NEW.id,
          'staff_name',  NEW.full_name,
          'phone',       NEW.phone,
          'avg_score',   ROUND(avg_score, 2),
          'score_count', score_count
        )
      WHERE NOT EXISTS (
        SELECT 1 FROM workflow_queue
        WHERE tenant_id = NEW.tenant_id
          AND workflow_type = 'burnout_alert'
          AND payload->>'staff_id' = NEW.id::text
          AND created_at > now() - interval '48 hours'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_wellness_burnout ON staff;
CREATE TRIGGER trg_wellness_burnout
  AFTER UPDATE OF wellness_scores ON staff
  FOR EACH ROW EXECUTE FUNCTION fn_trigger_burnout_alert();

-- TRIGGER 4: Contract with expiry_date → queue expiry alert 30 days before
CREATE OR REPLACE FUNCTION fn_trigger_contract_expiry()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.expiry_date IS NOT NULL AND NEW.document_type = 'contract' THEN
    INSERT INTO workflow_queue (tenant_id, workflow_type, payload, next_attempt_at)
    VALUES (
      NEW.tenant_id,
      'contract_expiry_alert',
      jsonb_build_object(
        'document_id',       NEW.id,
        'document_name',     NEW.file_name,
        'expiry_date',       NEW.expiry_date,
        'days_until_expiry', (NEW.expiry_date - CURRENT_DATE)
      ),
      (NEW.expiry_date - interval '30 days')::timestamptz
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_contract_expiry ON documents;
CREATE TRIGGER trg_contract_expiry
  AFTER INSERT OR UPDATE OF expiry_date ON documents
  FOR EACH ROW EXECUTE FUNCTION fn_trigger_contract_expiry();

-- ---------------------------------------------------------------------------
-- F. ENABLE REALTIME
-- ---------------------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE workflow_queue;
ALTER PUBLICATION supabase_realtime ADD TABLE email_drafts;
ALTER PUBLICATION supabase_realtime ADD TABLE document_templates;
ALTER PUBLICATION supabase_realtime ADD TABLE calendar_events;
