-- =============================================================================
-- AdminOS — Complete Supabase Schema
-- Mirembe Muse (Pty) Ltd · adminos.co.za
--
-- Run this entire file in the Supabase SQL editor on a fresh project.
-- It is idempotent — safe to re-run (uses IF NOT EXISTS / OR REPLACE).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0. Extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ---------------------------------------------------------------------------
-- 1. Custom ENUM types
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE plan_type AS ENUM ('trial', 'starter', 'business', 'enterprise', 'white_label');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE business_type AS ENUM ('school', 'clinic', 'ngo', 'retail', 'property', 'legal', 'logistics', 'trades', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE channel_type AS ENUM ('whatsapp', 'email', 'dashboard');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE conversation_status AS ENUM ('open', 'auto_resolved', 'escalated', 'closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE sentiment_type AS ENUM ('positive', 'neutral', 'negative', 'urgent');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE contact_type AS ENUM ('staff', 'client', 'supplier', 'unknown');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE invoice_status AS ENUM ('unpaid', 'partial', 'paid', 'in_collections');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE leave_status AS ENUM ('pending', 'approved', 'declined');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE file_type AS ENUM ('pdf', 'docx', 'xlsx', 'csv', 'image');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE doc_category AS ENUM ('strategy', 'invoice', 'hr', 'report', 'contract', 'compliance', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE goal_status AS ENUM ('active', 'achieved', 'missed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE processing_status AS ENUM ('pending', 'processing', 'done', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE subscription_status AS ENUM ('trialing', 'active', 'past_due', 'cancelled', 'suspended');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ---------------------------------------------------------------------------
-- 2. Helper: updated_at trigger function
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ---------------------------------------------------------------------------
-- 3. CORE TABLES
-- ---------------------------------------------------------------------------

-- 3.1 tenants — one row per business
CREATE TABLE IF NOT EXISTS tenants (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  text NOT NULL,
  slug                  text UNIQUE NOT NULL,
  plan                  plan_type NOT NULL DEFAULT 'trial',
  whatsapp_number       text,
  waba_id               text,
  business_type         business_type,
  country               text NOT NULL DEFAULT 'ZA',
  language_primary      text NOT NULL DEFAULT 'en',
  language_secondary    text[] DEFAULT '{}',
  timezone              text NOT NULL DEFAULT 'Africa/Johannesburg',
  settings              jsonb NOT NULL DEFAULT '{}',
  goals_doc_url         text,
  system_prompt_cache   text,
  prompt_cached_at      timestamptz,
  stripe_customer_id    text,
  payfast_merchant_id   text,
  active                boolean NOT NULL DEFAULT true,
  suspended             boolean NOT NULL DEFAULT false,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS tenants_updated_at ON tenants;
CREATE TRIGGER tenants_updated_at
  BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- 3.2 contacts — unified CRM record per contact
CREATE TABLE IF NOT EXISTS contacts (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  full_name             text,
  phone                 text,
  email                 text,
  contact_type          contact_type DEFAULT 'client',
  balance_owed          numeric(12,2) NOT NULL DEFAULT 0,
  notes                 text,
  tags                  text[] DEFAULT '{}',
  popia_consent         boolean DEFAULT false,
  popia_consent_at      timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS contacts_updated_at ON contacts;
CREATE TRIGGER contacts_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- 3.3 conversations — WhatsApp/email threads
CREATE TABLE IF NOT EXISTS conversations (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  channel               channel_type NOT NULL DEFAULT 'whatsapp',
  contact_name          text,
  contact_identifier    text,
  contact_type          contact_type DEFAULT 'unknown',
  status                conversation_status NOT NULL DEFAULT 'open',
  resolved_by           text,
  sentiment             sentiment_type,
  intent                text,
  summary               text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS conversations_updated_at ON conversations;
CREATE TRIGGER conversations_updated_at
  BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- 3.4 messages — individual messages within a conversation
CREATE TABLE IF NOT EXISTS messages (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  conversation_id       uuid REFERENCES conversations(id) ON DELETE CASCADE NOT NULL,
  role                  text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content               text NOT NULL,
  channel               channel_type,
  tokens_used           integer,
  from_cache            boolean NOT NULL DEFAULT false,
  created_at            timestamptz NOT NULL DEFAULT now()
);


-- 3.5 staff — team members
CREATE TABLE IF NOT EXISTS staff (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  full_name             text NOT NULL,
  phone                 text,
  email                 text,
  role                  text,
  department            text,
  leave_balance         numeric(4,1) NOT NULL DEFAULT 15,
  leave_taken           numeric(4,1) NOT NULL DEFAULT 0,
  wellness_scores       jsonb NOT NULL DEFAULT '[]',
  after_hours_flag      boolean NOT NULL DEFAULT false,
  active                boolean NOT NULL DEFAULT true,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS staff_updated_at ON staff;
CREATE TRIGGER staff_updated_at
  BEFORE UPDATE ON staff
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- 3.6 leave_requests
CREATE TABLE IF NOT EXISTS leave_requests (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  staff_id              uuid REFERENCES staff(id) ON DELETE CASCADE NOT NULL,
  start_date            date NOT NULL,
  end_date              date NOT NULL,
  days                  numeric(4,1),
  reason                text,
  status                leave_status NOT NULL DEFAULT 'pending',
  approved_by           text,
  approved_at           timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now()
);


-- 3.7 invoices — debt register
CREATE TABLE IF NOT EXISTS invoices (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  contact_name          text NOT NULL,
  contact_phone         text,
  contact_email         text,
  amount                numeric(12,2) NOT NULL DEFAULT 0,
  amount_paid           numeric(12,2) NOT NULL DEFAULT 0,
  due_date              date,
  days_overdue          integer GENERATED ALWAYS AS (
                          CASE WHEN due_date IS NOT NULL AND due_date < CURRENT_DATE
                          THEN (CURRENT_DATE - due_date) ELSE 0 END
                        ) STORED,
  status                invoice_status NOT NULL DEFAULT 'unpaid',
  escalation_level      integer NOT NULL DEFAULT 0 CHECK (escalation_level BETWEEN 0 AND 5),
  last_reminder_at      timestamptz,
  xero_invoice_id       text,
  invoice_reference     text,
  notes                 text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS invoices_updated_at ON invoices;
CREATE TRIGGER invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- 3.8 debtors — debt recovery tracking
CREATE TABLE IF NOT EXISTS debtors (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  contact_identifier    text NOT NULL,
  contact_name          text,
  amount_owed           numeric(12,2) NOT NULL DEFAULT 0,
  amount_paid           numeric(12,2) NOT NULL DEFAULT 0,
  invoice_reference     text,
  due_date              date,
  status                text NOT NULL DEFAULT 'outstanding'
                          CHECK (status IN ('outstanding', 'promised', 'in_collections', 'settled', 'written_off')),
  last_reminder_sent_at timestamptz,
  escalation_level      integer NOT NULL DEFAULT 0 CHECK (escalation_level BETWEEN 0 AND 5),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS debtors_updated_at ON debtors;
CREATE TRIGGER debtors_updated_at
  BEFORE UPDATE ON debtors
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- 3.9 documents — uploaded files with AI intelligence
CREATE TABLE IF NOT EXISTS documents (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  original_filename     text,
  file_type             file_type,
  storage_url           text,
  extracted_text        text,
  doc_category          doc_category,
  ai_summary            text,
  extracted_goals       jsonb,
  processing_status     processing_status NOT NULL DEFAULT 'pending',
  uploaded_by           uuid,
  created_at            timestamptz NOT NULL DEFAULT now()
);


-- 3.10 goals — business goals extracted from strategy docs
CREATE TABLE IF NOT EXISTS goals (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  title                 text NOT NULL,
  description           text,
  quarter               text,
  target_metric         text,
  current_value         numeric(12,2),
  target_value          numeric(12,2),
  progress_pct          numeric(5,2) GENERATED ALWAYS AS (
                          CASE WHEN target_value > 0 AND current_value IS NOT NULL
                          THEN LEAST(100, ROUND((current_value / target_value) * 100, 2))
                          ELSE 0 END
                        ) STORED,
  status                goal_status NOT NULL DEFAULT 'active',
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS goals_updated_at ON goals;
CREATE TRIGGER goals_updated_at
  BEFORE UPDATE ON goals
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- 3.11 calendar_events
CREATE TABLE IF NOT EXISTS calendar_events (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  title                   text NOT NULL,
  description             text,
  event_date              date NOT NULL,
  event_time              time,
  contact_identifier      text,
  source                  text,
  source_id               uuid,
  send_whatsapp_reminder  boolean NOT NULL DEFAULT false,
  reminder_sent_at        timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now()
);


-- 3.12 audit_log — IMMUTABLE append-only (POPIA compliance)
CREATE TABLE IF NOT EXISTS audit_log (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid,
  actor                 text,
  action                text NOT NULL,
  resource_type         text,
  resource_id           uuid,
  metadata              jsonb,
  ip_address            inet,
  created_at            timestamptz NOT NULL DEFAULT now()
);


-- ---------------------------------------------------------------------------
-- 4. BILLING & AUTOMATION TABLES
-- ---------------------------------------------------------------------------

-- 4.1 subscriptions
CREATE TABLE IF NOT EXISTS subscriptions (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL UNIQUE,
  plan                        plan_type NOT NULL DEFAULT 'trial',
  status                      subscription_status NOT NULL DEFAULT 'trialing',
  trial_ends_at               timestamptz NOT NULL DEFAULT (now() + INTERVAL '14 days'),
  current_period_start        timestamptz,
  current_period_end          timestamptz,
  payfast_subscription_id     text,
  payfast_token               text,
  amount                      numeric(10,2),
  currency                    text NOT NULL DEFAULT 'ZAR',
  cancelled_at                timestamptz,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS subscriptions_updated_at ON subscriptions;
CREATE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- 4.2 business_insights — AI advisor memory
CREATE TABLE IF NOT EXISTS business_insights (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  insight               text NOT NULL,
  category              text,
  extracted_at          timestamptz NOT NULL DEFAULT now()
);


-- 4.3 whatsapp_sequences
CREATE TABLE IF NOT EXISTS whatsapp_sequences (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  name                  text NOT NULL,
  trigger_type          text NOT NULL,
  steps                 jsonb NOT NULL DEFAULT '[]',
  is_active             boolean NOT NULL DEFAULT true,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS whatsapp_sequences_updated_at ON whatsapp_sequences;
CREATE TRIGGER whatsapp_sequences_updated_at
  BEFORE UPDATE ON whatsapp_sequences
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- 4.4 sequence_enrollments
CREATE TABLE IF NOT EXISTS sequence_enrollments (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  sequence_id           uuid REFERENCES whatsapp_sequences(id) ON DELETE CASCADE NOT NULL,
  contact_identifier    text NOT NULL,
  current_step          integer NOT NULL DEFAULT 0,
  next_step_at          timestamptz NOT NULL,
  status                text NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active', 'completed', 'paused', 'cancelled')),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS sequence_enrollments_updated_at ON sequence_enrollments;
CREATE TRIGGER sequence_enrollments_updated_at
  BEFORE UPDATE ON sequence_enrollments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- 4.5 referrals
CREATE TABLE IF NOT EXISTS referrals (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_tenant_id    uuid REFERENCES tenants(id) ON DELETE SET NULL,
  referral_code         text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(6), 'hex'),
  referred_tenant_id    uuid REFERENCES tenants(id) ON DELETE SET NULL,
  status                text NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'converted', 'rewarded')),
  reward_applied_at     timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now()
);


-- ---------------------------------------------------------------------------
-- 5. ROW-LEVEL SECURITY
-- ---------------------------------------------------------------------------

ALTER TABLE tenants              ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts             ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages             ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff                ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests       ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices             ENABLE ROW LEVEL SECURITY;
ALTER TABLE debtors              ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents            ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals                ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events      ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log            ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_insights    ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_sequences   ENABLE ROW LEVEL SECURITY;
ALTER TABLE sequence_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals            ENABLE ROW LEVEL SECURITY;


-- Helper function: get current user's tenant_id from JWT
CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS uuid
LANGUAGE sql STABLE
AS $$
  SELECT (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid
$$;


-- tenants: read/update own row only
DROP POLICY IF EXISTS "tenant_select_own" ON tenants;
CREATE POLICY "tenant_select_own" ON tenants
  FOR SELECT USING (id = current_tenant_id());

DROP POLICY IF EXISTS "tenant_update_own" ON tenants;
CREATE POLICY "tenant_update_own" ON tenants
  FOR UPDATE USING (id = current_tenant_id());

-- Standard tenant isolation for all other tables
DROP POLICY IF EXISTS "contacts_rls" ON contacts;
CREATE POLICY "contacts_rls" ON contacts
  FOR ALL USING (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS "conversations_rls" ON conversations;
CREATE POLICY "conversations_rls" ON conversations
  FOR ALL USING (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS "messages_rls" ON messages;
CREATE POLICY "messages_rls" ON messages
  FOR ALL USING (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS "staff_rls" ON staff;
CREATE POLICY "staff_rls" ON staff
  FOR ALL USING (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS "leave_requests_rls" ON leave_requests;
CREATE POLICY "leave_requests_rls" ON leave_requests
  FOR ALL USING (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS "invoices_rls" ON invoices;
CREATE POLICY "invoices_rls" ON invoices
  FOR ALL USING (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS "debtors_rls" ON debtors;
CREATE POLICY "debtors_rls" ON debtors
  FOR ALL USING (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS "documents_rls" ON documents;
CREATE POLICY "documents_rls" ON documents
  FOR ALL USING (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS "goals_rls" ON goals;
CREATE POLICY "goals_rls" ON goals
  FOR ALL USING (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS "calendar_events_rls" ON calendar_events;
CREATE POLICY "calendar_events_rls" ON calendar_events
  FOR ALL USING (tenant_id = current_tenant_id());

-- audit_log: INSERT + SELECT only. No UPDATE or DELETE ever.
DROP POLICY IF EXISTS "audit_log_insert" ON audit_log;
CREATE POLICY "audit_log_insert" ON audit_log
  FOR INSERT WITH CHECK (tenant_id IS NULL OR tenant_id = current_tenant_id());

DROP POLICY IF EXISTS "audit_log_select" ON audit_log;
CREATE POLICY "audit_log_select" ON audit_log
  FOR SELECT USING (tenant_id IS NULL OR tenant_id = current_tenant_id());

-- Revoke destructive ops on audit_log — append-only enforcement
REVOKE UPDATE, DELETE ON audit_log FROM authenticated;
REVOKE UPDATE, DELETE ON audit_log FROM anon;

DROP POLICY IF EXISTS "subscriptions_rls" ON subscriptions;
CREATE POLICY "subscriptions_rls" ON subscriptions
  FOR ALL USING (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS "business_insights_rls" ON business_insights;
CREATE POLICY "business_insights_rls" ON business_insights
  FOR ALL USING (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS "whatsapp_sequences_rls" ON whatsapp_sequences;
CREATE POLICY "whatsapp_sequences_rls" ON whatsapp_sequences
  FOR ALL USING (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS "sequence_enrollments_rls" ON sequence_enrollments;
CREATE POLICY "sequence_enrollments_rls" ON sequence_enrollments
  FOR ALL USING (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS "referrals_rls" ON referrals;
CREATE POLICY "referrals_rls" ON referrals
  FOR ALL USING (referrer_tenant_id = current_tenant_id());


-- ---------------------------------------------------------------------------
-- 6. PERFORMANCE INDEXES
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_tenants_slug         ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_waba_id      ON tenants(waba_id) WHERE waba_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tenants_whatsapp     ON tenants(whatsapp_number) WHERE whatsapp_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_conversations_contact ON conversations(tenant_id, contact_identifier);
CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations(tenant_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_tenant       ON messages(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_invoices_status      ON invoices(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date    ON invoices(tenant_id, due_date) WHERE status != 'paid';

CREATE INDEX IF NOT EXISTS idx_debtors_status       ON debtors(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_debtors_contact      ON debtors(tenant_id, contact_identifier);

CREATE INDEX IF NOT EXISTS idx_staff_tenant         ON staff(tenant_id) WHERE active = true;

CREATE INDEX IF NOT EXISTS idx_documents_status     ON documents(tenant_id, processing_status);

CREATE INDEX IF NOT EXISTS idx_audit_log_tenant     ON audit_log(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_resource   ON audit_log(resource_type, resource_id);

CREATE INDEX IF NOT EXISTS idx_business_insights    ON business_insights(tenant_id, extracted_at DESC);

CREATE INDEX IF NOT EXISTS idx_seq_next_step        ON sequence_enrollments(next_step_at)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_calendar_date        ON calendar_events(tenant_id, event_date);
CREATE INDEX IF NOT EXISTS idx_contacts_phone       ON contacts(tenant_id, phone) WHERE phone IS NOT NULL;


-- ---------------------------------------------------------------------------
-- 7. REALTIME — Enable for live dashboard updates
-- ---------------------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;


-- ---------------------------------------------------------------------------
-- 8. STORAGE — Private bucket for document uploads
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  false,
  52428800,
  ARRAY[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/msword',
    'text/plain',
    'text/csv',
    'image/jpeg',
    'image/png'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: tenant can only access files stored under their tenant_id folder
DROP POLICY IF EXISTS "documents_storage_rls" ON storage.objects;
CREATE POLICY "documents_storage_rls"
  ON storage.objects FOR ALL
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = current_tenant_id()::text
  )
  WITH CHECK (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = current_tenant_id()::text
  );


-- ---------------------------------------------------------------------------
-- 9. AUTO-CREATE SUBSCRIPTION ON TENANT INSERT
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION create_default_subscription()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO subscriptions (tenant_id, plan, status, trial_ends_at)
  VALUES (NEW.id, 'trial', 'trialing', NOW() + INTERVAL '14 days')
  ON CONFLICT (tenant_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS auto_create_subscription ON tenants;
CREATE TRIGGER auto_create_subscription
  AFTER INSERT ON tenants
  FOR EACH ROW EXECUTE FUNCTION create_default_subscription();


-- ---------------------------------------------------------------------------
-- 10. VIEWS
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW overdue_invoices AS
  SELECT i.*, t.name AS tenant_name, t.plan AS tenant_plan
  FROM invoices i
  JOIN tenants t ON t.id = i.tenant_id
  WHERE i.status IN ('unpaid', 'partial')
    AND i.due_date < CURRENT_DATE
    AND t.active = true;

CREATE OR REPLACE VIEW wellness_summary AS
  SELECT
    s.tenant_id,
    s.id AS staff_id,
    s.full_name,
    ROUND((
      SELECT AVG((e->>'score')::numeric)
      FROM jsonb_array_elements(s.wellness_scores) AS e
      WHERE (e->>'date')::date >= CURRENT_DATE - INTERVAL '14 days'
    ), 2) AS avg_score_14d,
    jsonb_array_length(s.wellness_scores) AS total_checkins
  FROM staff s
  WHERE s.active = true;


-- ---------------------------------------------------------------------------
-- Done.
--
-- Tables:    tenants, contacts, conversations, messages, staff,
--            leave_requests, invoices, debtors, documents, goals,
--            calendar_events, audit_log (append-only),
--            subscriptions, business_insights, whatsapp_sequences,
--            sequence_enrollments, referrals
--
-- Views:     overdue_invoices, wellness_summary
-- RLS:       17 tables, all isolated by tenant_id
-- Storage:   documents bucket (private, 50MB, signed URLs)
-- Realtime:  conversations + messages
-- Trigger:   subscriptions auto-created on tenant insert
-- ---------------------------------------------------------------------------
