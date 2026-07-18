-- =============================================================================
-- AdminOS — MASTER SCHEMA (single authoritative script)
-- Mirembe Muse (Pty) Ltd · adminos.co.za
-- Generated 2026-04-28 — replaces schema.sql + 002_v2_architecture.sql + 20260426_rls_audit.sql
--
-- HOW TO USE:
--   Paste this entire file into the Supabase SQL editor and click Run.
--   IDEMPOTENT — safe to re-run on a live database without data loss.
--
-- TO WIPE & START FRESH (new project / broken state):
--   Uncomment the NUCLEAR RESET block below, run once, then comment it back.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- OPTIONAL: NUCLEAR RESET — uncomment only on a fresh/broken project
-- WARNING: destroys all data
-- ---------------------------------------------------------------------------
/*
DROP TABLE IF EXISTS email_drafts          CASCADE;
DROP TABLE IF EXISTS document_templates    CASCADE;
DROP TABLE IF EXISTS workflow_queue        CASCADE;
DROP TABLE IF EXISTS referrals             CASCADE;
DROP TABLE IF EXISTS sequence_enrollments  CASCADE;
DROP TABLE IF EXISTS whatsapp_sequences    CASCADE;
DROP TABLE IF EXISTS business_insights     CASCADE;
DROP TABLE IF EXISTS subscriptions         CASCADE;
DROP TABLE IF EXISTS audit_log             CASCADE;
DROP TABLE IF EXISTS calendar_events       CASCADE;
DROP TABLE IF EXISTS goals                 CASCADE;
DROP TABLE IF EXISTS documents             CASCADE;
DROP TABLE IF EXISTS debtors               CASCADE;
DROP TABLE IF EXISTS invoices              CASCADE;
DROP TABLE IF EXISTS leave_requests        CASCADE;
DROP TABLE IF EXISTS staff                 CASCADE;
DROP TABLE IF EXISTS messages              CASCADE;
DROP TABLE IF EXISTS conversations         CASCADE;
DROP TABLE IF EXISTS contacts              CASCADE;
DROP TABLE IF EXISTS tenants               CASCADE;

DROP TYPE IF EXISTS plan_type            CASCADE;
DROP TYPE IF EXISTS business_type        CASCADE;
DROP TYPE IF EXISTS channel_type         CASCADE;
DROP TYPE IF EXISTS conversation_status  CASCADE;
DROP TYPE IF EXISTS sentiment_type       CASCADE;
DROP TYPE IF EXISTS contact_type         CASCADE;
DROP TYPE IF EXISTS invoice_status       CASCADE;
DROP TYPE IF EXISTS leave_status         CASCADE;
DROP TYPE IF EXISTS file_type            CASCADE;
DROP TYPE IF EXISTS doc_category         CASCADE;
DROP TYPE IF EXISTS goal_status          CASCADE;
DROP TYPE IF EXISTS processing_status    CASCADE;
DROP TYPE IF EXISTS subscription_status  CASCADE;
*/


-- ---------------------------------------------------------------------------
-- 0. Extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ---------------------------------------------------------------------------
-- 1. Custom ENUM types (idempotent)
-- ---------------------------------------------------------------------------
DO $$ BEGIN CREATE TYPE plan_type AS ENUM ('trial','starter','business','enterprise','white_label'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE business_type AS ENUM ('school','clinic','ngo','retail','property','legal','logistics','trades','other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE channel_type AS ENUM ('whatsapp','email','dashboard'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE conversation_status AS ENUM ('open','auto_resolved','escalated','closed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE sentiment_type AS ENUM ('positive','neutral','negative','urgent'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE contact_type AS ENUM ('staff','client','supplier','unknown'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE invoice_status AS ENUM ('unpaid','partial','paid','in_collections'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE leave_status AS ENUM ('pending','approved','declined'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE file_type AS ENUM ('pdf','docx','xlsx','csv','image'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE doc_category AS ENUM ('strategy','invoice','hr','report','contract','compliance','other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE goal_status AS ENUM ('active','achieved','missed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE processing_status AS ENUM ('pending','processing','done','failed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE subscription_status AS ENUM ('trialing','active','past_due','cancelled','suspended'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ---------------------------------------------------------------------------
-- 2. Shared helper functions
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END $$;

-- Reads tenant_id from the JWT's app_metadata — service-role writable only.
-- NEVER read tenant_id from user_metadata: the user owns that object and can
-- rewrite it via supabase.auth.updateUser(), which made every RLS policy below
-- spoofable. See migrations/20260717_phase0_tenant_isolation.sql.
-- Returns NULL when absent, which denies access by design. Do not add a fallback.
CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT NULLIF(auth.jwt() -> 'app_metadata' ->> 'tenant_id', '')::uuid
$$;

-- Coarse role hint for RLS policies. The authoritative permission check is the
-- user_roles table via lib/auth/context.ts — not this.
CREATE OR REPLACE FUNCTION current_user_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT auth.jwt() -> 'app_metadata' ->> 'role'
$$;


-- ---------------------------------------------------------------------------
-- 3. CORE TABLES (in FK dependency order)
-- ---------------------------------------------------------------------------

-- 3.1  tenants — one row per business (multi-tenancy root)
CREATE TABLE IF NOT EXISTS tenants (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                text        NOT NULL,
  slug                text        UNIQUE NOT NULL,
  plan                plan_type   NOT NULL DEFAULT 'trial',
  whatsapp_number     text,
  waba_id             text,
  business_type       business_type,
  country             text        NOT NULL DEFAULT 'ZA',
  language_primary    text        NOT NULL DEFAULT 'en',
  language_secondary  text[]      DEFAULT '{}',
  timezone            text        NOT NULL DEFAULT 'Africa/Johannesburg',
  settings            jsonb       NOT NULL DEFAULT '{}',
  goals_doc_url       text,
  system_prompt_cache text,
  prompt_cached_at    timestamptz,
  stripe_customer_id  text,
  payfast_merchant_id text,
  active              boolean     NOT NULL DEFAULT true,
  suspended           boolean     NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS tenants_updated_at ON tenants;
CREATE TRIGGER tenants_updated_at
  BEFORE UPDATE ON tenants FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- 3.2  contacts — unified CRM record
CREATE TABLE IF NOT EXISTS contacts (
  id                uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  full_name         text,
  phone             text,
  email             text,
  company           text,
  contact_type      contact_type  DEFAULT 'client',
  balance_owed      numeric(12,2) NOT NULL DEFAULT 0,
  total_invoiced    numeric(12,2) NOT NULL DEFAULT 0,
  total_paid        numeric(12,2) NOT NULL DEFAULT 0,
  last_contacted_at timestamptz,
  sentiment_score   integer,
  notes             text,
  tags              text[]        DEFAULT '{}',
  popia_consent     boolean       DEFAULT false,
  popia_consent_at  timestamptz,
  created_at        timestamptz   NOT NULL DEFAULT now(),
  updated_at        timestamptz   NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS contacts_updated_at ON contacts;
CREATE TRIGGER contacts_updated_at
  BEFORE UPDATE ON contacts FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- 3.3  conversations — WhatsApp / email threads
CREATE TABLE IF NOT EXISTS conversations (
  id                 uuid                PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid                NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contact_id         uuid                REFERENCES contacts(id),
  channel            channel_type        NOT NULL DEFAULT 'whatsapp',
  contact_name       text,
  contact_identifier text,
  contact_type       contact_type        DEFAULT 'unknown',
  status             conversation_status NOT NULL DEFAULT 'open',
  resolved_by        text,
  sentiment          sentiment_type,
  intent             text,
  summary            text,
  created_at         timestamptz         NOT NULL DEFAULT now(),
  updated_at         timestamptz         NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS conversations_updated_at ON conversations;
CREATE TRIGGER conversations_updated_at
  BEFORE UPDATE ON conversations FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- 3.4  messages — individual messages within a conversation
CREATE TABLE IF NOT EXISTS messages (
  id                  uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  conversation_id     uuid         NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role                text         NOT NULL CHECK (role IN ('user','assistant','system')),
  content             text         NOT NULL,
  channel             channel_type,
  tokens_used         integer,
  from_cache          boolean      NOT NULL DEFAULT false,
  delivery_status     text         DEFAULT 'sent',
  delivered_at        timestamptz,
  read_at             timestamptz,
  whatsapp_message_id text,
  created_at          timestamptz  NOT NULL DEFAULT now()
);


-- 3.5  staff — team members
CREATE TABLE IF NOT EXISTS staff (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  full_name        text        NOT NULL,
  phone            text,
  email            text,
  role             text,
  department       text,
  leave_balance    numeric(4,1) NOT NULL DEFAULT 15,
  leave_taken      numeric(4,1) NOT NULL DEFAULT 0,
  wellness_scores  jsonb        NOT NULL DEFAULT '[]',
  after_hours_flag boolean      NOT NULL DEFAULT false,
  active           boolean      NOT NULL DEFAULT true,
  created_at       timestamptz  NOT NULL DEFAULT now(),
  updated_at       timestamptz  NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS staff_updated_at ON staff;
CREATE TRIGGER staff_updated_at
  BEFORE UPDATE ON staff FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- 3.6  leave_requests
CREATE TABLE IF NOT EXISTS leave_requests (
  id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  staff_id    uuid         NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  start_date  date         NOT NULL,
  end_date    date         NOT NULL,
  days        numeric(4,1),
  reason      text,
  status      leave_status NOT NULL DEFAULT 'pending',
  approved_by text,
  approved_at timestamptz,
  created_at  timestamptz  NOT NULL DEFAULT now()
);


-- 3.7  invoices — debt register
CREATE TABLE IF NOT EXISTS invoices (
  id                    uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid           NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contact_name          text           NOT NULL,
  contact_phone         text,
  contact_email         text,
  amount                numeric(12,2)  NOT NULL DEFAULT 0,
  amount_paid           numeric(12,2)  NOT NULL DEFAULT 0,
  due_date              date,
  -- days_overdue is NOT stored — compute it in queries as: GREATEST(0, CURRENT_DATE - due_date)
  status                invoice_status NOT NULL DEFAULT 'unpaid',
  escalation_level      integer        NOT NULL DEFAULT 0 CHECK (escalation_level BETWEEN 0 AND 5),
  recovery_tier         integer        NOT NULL DEFAULT 0,
  last_reminder_at      timestamptz,
  last_reminder_sent_at timestamptz,
  xero_invoice_id       text,
  invoice_reference     text,
  notes                 text,
  created_at            timestamptz    NOT NULL DEFAULT now(),
  updated_at            timestamptz    NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS invoices_updated_at ON invoices;
CREATE TRIGGER invoices_updated_at
  BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- 3.8  debtors — debt recovery tracking
CREATE TABLE IF NOT EXISTS debtors (
  id                    uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contact_identifier    text          NOT NULL,
  contact_name          text,
  amount_owed           numeric(12,2) NOT NULL DEFAULT 0,
  amount_paid           numeric(12,2) NOT NULL DEFAULT 0,
  invoice_reference     text,
  due_date              date,
  status                text          NOT NULL DEFAULT 'outstanding'
                          CHECK (status IN ('outstanding','promised','in_collections','settled','written_off')),
  last_reminder_sent_at timestamptz,
  escalation_level      integer       NOT NULL DEFAULT 0 CHECK (escalation_level BETWEEN 0 AND 5),
  created_at            timestamptz   NOT NULL DEFAULT now(),
  updated_at            timestamptz   NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS debtors_updated_at ON debtors;
CREATE TRIGGER debtors_updated_at
  BEFORE UPDATE ON debtors FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- 3.9  documents — uploaded files with AI intelligence
CREATE TABLE IF NOT EXISTS documents (
  id                uuid              PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid              NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  original_filename text,
  file_type         file_type,
  storage_url       text,
  extracted_text    text,
  doc_category      doc_category,
  ai_summary        text,
  extracted_goals   jsonb,
  extracted_data    jsonb             DEFAULT '{}',
  processing_status processing_status NOT NULL DEFAULT 'pending',
  uploaded_by       uuid,
  is_reference      boolean           NOT NULL DEFAULT false,
  document_type     text,
  expiry_date       date,
  key_parties       text[],
  key_obligations   text[],
  recovery_tier     integer           NOT NULL DEFAULT 0,
  created_at        timestamptz       NOT NULL DEFAULT now()
);


-- 3.10 goals — business goals extracted from strategy docs
CREATE TABLE IF NOT EXISTS goals (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title         text        NOT NULL,
  description   text,
  quarter       text,
  target_metric text,
  current_value numeric(12,2),
  target_value  numeric(12,2),
  progress_pct  numeric(5,2) GENERATED ALWAYS AS (
                  CASE WHEN target_value > 0 AND current_value IS NOT NULL
                  THEN LEAST(100, ROUND((current_value / target_value) * 100, 2))
                  ELSE 0 END
                ) STORED,
  status        goal_status NOT NULL DEFAULT 'active',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS goals_updated_at ON goals;
CREATE TRIGGER goals_updated_at
  BEFORE UPDATE ON goals FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- 3.11 calendar_events — unified from both migrations
CREATE TABLE IF NOT EXISTS calendar_events (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title                  text        NOT NULL,
  description            text,
  event_date             date,
  event_time             time,
  event_type             text        NOT NULL DEFAULT 'manual',
  start_at               timestamptz,
  end_at                 timestamptz,
  all_day                boolean     NOT NULL DEFAULT false,
  contact_identifier     text,
  source                 text,
  source_type            text,
  source_id              uuid,
  send_whatsapp_reminder boolean     NOT NULL DEFAULT false,
  reminder_sent_at       timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now()
);


-- 3.12 audit_log — IMMUTABLE append-only (POPIA compliance)
--      No UPDATE/DELETE policies created — enforced at RLS layer.
CREATE TABLE IF NOT EXISTS audit_log (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid,
  actor         text,
  action        text        NOT NULL,
  resource_type text,
  resource_id   uuid,
  metadata      jsonb,
  ip_address    inet,
  created_at    timestamptz NOT NULL DEFAULT now()
);


-- ---------------------------------------------------------------------------
-- 4. BILLING & AUTOMATION TABLES
-- ---------------------------------------------------------------------------

-- 4.1  subscriptions — PayFast billing state (one per tenant)
CREATE TABLE IF NOT EXISTS subscriptions (
  id                      uuid                 PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               uuid                 NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  plan                    plan_type            NOT NULL DEFAULT 'trial',
  status                  subscription_status  NOT NULL DEFAULT 'trialing',
  trial_ends_at           timestamptz          NOT NULL DEFAULT (now() + INTERVAL '14 days'),
  current_period_start    timestamptz,
  current_period_end      timestamptz,
  payfast_subscription_id text,
  payfast_token           text,
  amount                  numeric(10,2),
  currency                text                 NOT NULL DEFAULT 'ZAR',
  cancelled_at            timestamptz,
  created_at              timestamptz          NOT NULL DEFAULT now(),
  updated_at              timestamptz          NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS subscriptions_updated_at ON subscriptions;
CREATE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- 4.2  business_insights — AI advisor memory
CREATE TABLE IF NOT EXISTS business_insights (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  insight      text        NOT NULL,
  category     text,
  extracted_at timestamptz NOT NULL DEFAULT now()
);


-- 4.3  whatsapp_sequences — automated message sequences
CREATE TABLE IF NOT EXISTS whatsapp_sequences (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name         text        NOT NULL,
  trigger_type text        NOT NULL,
  steps        jsonb       NOT NULL DEFAULT '[]',
  is_active    boolean     NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS whatsapp_sequences_updated_at ON whatsapp_sequences;
CREATE TRIGGER whatsapp_sequences_updated_at
  BEFORE UPDATE ON whatsapp_sequences FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- 4.4  sequence_enrollments — contact enrollment in sequences
CREATE TABLE IF NOT EXISTS sequence_enrollments (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  sequence_id        uuid        NOT NULL REFERENCES whatsapp_sequences(id) ON DELETE CASCADE,
  contact_identifier text        NOT NULL,
  current_step       integer     NOT NULL DEFAULT 0,
  next_step_at       timestamptz NOT NULL,
  status             text        NOT NULL DEFAULT 'active'
                       CHECK (status IN ('active','completed','paused','cancelled')),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS sequence_enrollments_updated_at ON sequence_enrollments;
CREATE TRIGGER sequence_enrollments_updated_at
  BEFORE UPDATE ON sequence_enrollments FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- 4.5  referrals — referral program
CREATE TABLE IF NOT EXISTS referrals (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_tenant_id uuid        REFERENCES tenants(id) ON DELETE SET NULL,
  referral_code      text        UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(6), 'hex'),
  referred_tenant_id uuid        REFERENCES tenants(id) ON DELETE SET NULL,
  status             text        NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending','converted','rewarded')),
  reward_applied_at  timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now()
);


-- 4.6  workflow_queue — automation job queue (nerve centre)
CREATE TABLE IF NOT EXISTS workflow_queue (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workflow_type         text        NOT NULL,
  payload               jsonb       NOT NULL DEFAULT '{}',
  status                text        NOT NULL DEFAULT 'pending',
  attempts              integer     NOT NULL DEFAULT 0,
  max_attempts          integer     NOT NULL DEFAULT 3,
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
      'debt_recovery_initiated','document_uploaded','wellness_due',
      'burnout_alert','brief_generate','trial_expiring',
      'contact_sentiment_low','xero_invoice_paid','subscription_activated',
      'subscription_cancelled','onboarding_sequence','escalation_due',
      'email_draft_requested','contract_expiry_alert','payroll_reminder'
    )
  )
);


-- 4.7  document_templates — shadow documents (structure only)
CREATE TABLE IF NOT EXISTS document_templates (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  document_type    text        NOT NULL,
  template_name    text        NOT NULL,
  description      text,
  extracted_schema jsonb       DEFAULT '{}',
  is_reference     boolean     NOT NULL DEFAULT false,
  storage_path     text,
  file_type        text,
  status           text        DEFAULT 'pending',
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


-- 4.8  email_drafts — Pen agent outputs
CREATE TABLE IF NOT EXISTS email_drafts (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email_type      text        NOT NULL,
  category        text        NOT NULL,
  subject         text        NOT NULL,
  body            text        NOT NULL,
  recipient_name  text,
  recipient_email text,
  context_type    text,
  context_id      uuid,
  tone_used       text,
  language_used   text        DEFAULT 'en',
  data_sources    jsonb       DEFAULT '[]',
  status          text        NOT NULL DEFAULT 'draft',
  is_template     boolean     NOT NULL DEFAULT false,
  template_name   text,
  sent_at         timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT valid_email_status CHECK (
    status IN ('draft','sent','saved_template','archived')
  )
);


-- ---------------------------------------------------------------------------
-- 5. ENSURE COLUMNS EXIST on pre-existing tables
--    (safe no-ops if running on a fresh database)
-- ---------------------------------------------------------------------------
ALTER TABLE contacts     ADD COLUMN IF NOT EXISTS company           text;
ALTER TABLE contacts     ADD COLUMN IF NOT EXISTS total_invoiced    numeric(12,2) DEFAULT 0;
ALTER TABLE contacts     ADD COLUMN IF NOT EXISTS total_paid        numeric(12,2) DEFAULT 0;
ALTER TABLE contacts     ADD COLUMN IF NOT EXISTS last_contacted_at timestamptz;
ALTER TABLE contacts     ADD COLUMN IF NOT EXISTS sentiment_score   integer;

ALTER TABLE conversations ADD COLUMN IF NOT EXISTS contact_id uuid REFERENCES contacts(id);

ALTER TABLE messages     ADD COLUMN IF NOT EXISTS delivery_status     text DEFAULT 'sent';
ALTER TABLE messages     ADD COLUMN IF NOT EXISTS delivered_at        timestamptz;
ALTER TABLE messages     ADD COLUMN IF NOT EXISTS read_at             timestamptz;
ALTER TABLE messages     ADD COLUMN IF NOT EXISTS whatsapp_message_id text;

ALTER TABLE invoices     ADD COLUMN IF NOT EXISTS recovery_tier         integer DEFAULT 0;
ALTER TABLE invoices     ADD COLUMN IF NOT EXISTS last_reminder_sent_at timestamptz;

ALTER TABLE documents    ADD COLUMN IF NOT EXISTS is_reference      boolean DEFAULT false;
ALTER TABLE documents    ADD COLUMN IF NOT EXISTS document_type     text;
ALTER TABLE documents    ADD COLUMN IF NOT EXISTS extracted_data    jsonb   DEFAULT '{}';
ALTER TABLE documents    ADD COLUMN IF NOT EXISTS expiry_date       date;
ALTER TABLE documents    ADD COLUMN IF NOT EXISTS key_parties       text[];
ALTER TABLE documents    ADD COLUMN IF NOT EXISTS key_obligations   text[];
ALTER TABLE documents    ADD COLUMN IF NOT EXISTS recovery_tier     integer DEFAULT 0;

ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS event_type   text        DEFAULT 'manual';
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS start_at     timestamptz;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS end_at       timestamptz;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS all_day      boolean     DEFAULT false;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS source_type  text;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS event_date   date;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS event_time   time;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS send_whatsapp_reminder boolean DEFAULT false;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;

ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS payfast_subscription_id text;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS amount                  numeric(10,2);
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS currency                text DEFAULT 'ZAR';


-- ---------------------------------------------------------------------------
-- 6. ROW LEVEL SECURITY — enable on all tables
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
ALTER TABLE workflow_queue       ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_templates   ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_drafts         ENABLE ROW LEVEL SECURITY;


-- ---------------------------------------------------------------------------
-- 7. DROP all known legacy policy names (from all previous migrations)
-- ---------------------------------------------------------------------------
-- From schema.sql
DROP POLICY IF EXISTS "tenant_select_own"          ON tenants;
DROP POLICY IF EXISTS "tenant_update_own"           ON tenants;
DROP POLICY IF EXISTS "contacts_rls"                ON contacts;
DROP POLICY IF EXISTS "conversations_rls"           ON conversations;
DROP POLICY IF EXISTS "messages_rls"                ON messages;
DROP POLICY IF EXISTS "staff_rls"                   ON staff;
DROP POLICY IF EXISTS "leave_requests_rls"          ON leave_requests;
DROP POLICY IF EXISTS "invoices_rls"                ON invoices;
DROP POLICY IF EXISTS "debtors_rls"                 ON debtors;
DROP POLICY IF EXISTS "documents_rls"               ON documents;
DROP POLICY IF EXISTS "goals_rls"                   ON goals;
DROP POLICY IF EXISTS "calendar_events_rls"         ON calendar_events;
DROP POLICY IF EXISTS "audit_log_insert"            ON audit_log;
DROP POLICY IF EXISTS "audit_log_select"            ON audit_log;
DROP POLICY IF EXISTS "subscriptions_rls"           ON subscriptions;
DROP POLICY IF EXISTS "business_insights_rls"       ON business_insights;
DROP POLICY IF EXISTS "whatsapp_sequences_rls"      ON whatsapp_sequences;
DROP POLICY IF EXISTS "sequence_enrollments_rls"    ON sequence_enrollments;
DROP POLICY IF EXISTS "referrals_rls"               ON referrals;
-- From 002_v2_architecture.sql
DROP POLICY IF EXISTS "Tenants read own workflow queue"          ON workflow_queue;
DROP POLICY IF EXISTS "Tenant isolation on document_templates"  ON document_templates;
DROP POLICY IF EXISTS "Tenant isolation on email_drafts"        ON email_drafts;
DROP POLICY IF EXISTS "Tenant isolation on calendar_events"     ON calendar_events;
DROP POLICY IF EXISTS "Tenants read own subscription"           ON subscriptions;
-- From 20260426_rls_audit.sql (granular per-operation names)
DROP POLICY IF EXISTS "conversations_select"        ON conversations;
DROP POLICY IF EXISTS "conversations_insert"        ON conversations;
DROP POLICY IF EXISTS "conversations_update"        ON conversations;
DROP POLICY IF EXISTS "conversations_delete"        ON conversations;
DROP POLICY IF EXISTS "messages_select"             ON messages;
DROP POLICY IF EXISTS "messages_insert"             ON messages;
DROP POLICY IF EXISTS "messages_update"             ON messages;
DROP POLICY IF EXISTS "messages_delete"             ON messages;
DROP POLICY IF EXISTS "contacts_select"             ON contacts;
DROP POLICY IF EXISTS "contacts_insert"             ON contacts;
DROP POLICY IF EXISTS "contacts_update"             ON contacts;
DROP POLICY IF EXISTS "contacts_delete"             ON contacts;
DROP POLICY IF EXISTS "staff_select"                ON staff;
DROP POLICY IF EXISTS "staff_insert"                ON staff;
DROP POLICY IF EXISTS "staff_update"                ON staff;
DROP POLICY IF EXISTS "staff_delete"                ON staff;
DROP POLICY IF EXISTS "invoices_select"             ON invoices;
DROP POLICY IF EXISTS "invoices_insert"             ON invoices;
DROP POLICY IF EXISTS "invoices_update"             ON invoices;
DROP POLICY IF EXISTS "invoices_delete"             ON invoices;
DROP POLICY IF EXISTS "debtors_select"              ON debtors;
DROP POLICY IF EXISTS "debtors_insert"              ON debtors;
DROP POLICY IF EXISTS "debtors_update"              ON debtors;
DROP POLICY IF EXISTS "debtors_delete"              ON debtors;
DROP POLICY IF EXISTS "documents_select"            ON documents;
DROP POLICY IF EXISTS "documents_insert"            ON documents;
DROP POLICY IF EXISTS "documents_update"            ON documents;
DROP POLICY IF EXISTS "documents_delete"            ON documents;
DROP POLICY IF EXISTS "goals_select"                ON goals;
DROP POLICY IF EXISTS "goals_insert"                ON goals;
DROP POLICY IF EXISTS "goals_update"                ON goals;
DROP POLICY IF EXISTS "goals_delete"                ON goals;
DROP POLICY IF EXISTS "calendar_events_select"      ON calendar_events;
DROP POLICY IF EXISTS "calendar_events_insert"      ON calendar_events;
DROP POLICY IF EXISTS "calendar_events_update"      ON calendar_events;
DROP POLICY IF EXISTS "calendar_events_delete"      ON calendar_events;
DROP POLICY IF EXISTS "leave_requests_select"       ON leave_requests;
DROP POLICY IF EXISTS "leave_requests_insert"       ON leave_requests;
DROP POLICY IF EXISTS "leave_requests_update"       ON leave_requests;
DROP POLICY IF EXISTS "leave_requests_delete"       ON leave_requests;
DROP POLICY IF EXISTS "subscriptions_select"        ON subscriptions;
DROP POLICY IF EXISTS "subscriptions_insert"        ON subscriptions;
DROP POLICY IF EXISTS "subscriptions_update"        ON subscriptions;
DROP POLICY IF EXISTS "subscriptions_delete"        ON subscriptions;
DROP POLICY IF EXISTS "business_insights_select"    ON business_insights;
DROP POLICY IF EXISTS "business_insights_insert"    ON business_insights;
DROP POLICY IF EXISTS "business_insights_update"    ON business_insights;
DROP POLICY IF EXISTS "business_insights_delete"    ON business_insights;
DROP POLICY IF EXISTS "whatsapp_sequences_select"   ON whatsapp_sequences;
DROP POLICY IF EXISTS "whatsapp_sequences_insert"   ON whatsapp_sequences;
DROP POLICY IF EXISTS "whatsapp_sequences_update"   ON whatsapp_sequences;
DROP POLICY IF EXISTS "whatsapp_sequences_delete"   ON whatsapp_sequences;
DROP POLICY IF EXISTS "sequence_enrollments_select" ON sequence_enrollments;
DROP POLICY IF EXISTS "sequence_enrollments_insert" ON sequence_enrollments;
DROP POLICY IF EXISTS "sequence_enrollments_update" ON sequence_enrollments;
DROP POLICY IF EXISTS "sequence_enrollments_delete" ON sequence_enrollments;
DROP POLICY IF EXISTS "workflow_queue_rls"          ON workflow_queue;
DROP POLICY IF EXISTS "document_templates_rls"      ON document_templates;
DROP POLICY IF EXISTS "email_drafts_rls"            ON email_drafts;


-- ---------------------------------------------------------------------------
-- 8. RLS POLICIES — clean set (one FOR ALL per table with tenant isolation)
-- ---------------------------------------------------------------------------

-- tenants: users see/update only their own tenant row
CREATE POLICY "tenants_select" ON tenants
  FOR SELECT USING (id = current_tenant_id());
CREATE POLICY "tenants_update" ON tenants
  FOR UPDATE USING (id = current_tenant_id())
  WITH CHECK (id = current_tenant_id());

-- All tables below: full CRUD scoped to matching tenant_id
CREATE POLICY "contacts_rls" ON contacts
  FOR ALL USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "conversations_rls" ON conversations
  FOR ALL USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "messages_rls" ON messages
  FOR ALL USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "staff_rls" ON staff
  FOR ALL USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "leave_requests_rls" ON leave_requests
  FOR ALL USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "invoices_rls" ON invoices
  FOR ALL USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "debtors_rls" ON debtors
  FOR ALL USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "documents_rls" ON documents
  FOR ALL USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "goals_rls" ON goals
  FOR ALL USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "calendar_events_rls" ON calendar_events
  FOR ALL USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "subscriptions_rls" ON subscriptions
  FOR ALL USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "business_insights_rls" ON business_insights
  FOR ALL USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "whatsapp_sequences_rls" ON whatsapp_sequences
  FOR ALL USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "sequence_enrollments_rls" ON sequence_enrollments
  FOR ALL USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "workflow_queue_rls" ON workflow_queue
  FOR ALL USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "document_templates_rls" ON document_templates
  FOR ALL USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "email_drafts_rls" ON email_drafts
  FOR ALL USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- audit_log: INSERT + SELECT only — no UPDATE/DELETE policy = permanently denied
CREATE POLICY "audit_log_insert" ON audit_log
  FOR INSERT WITH CHECK (tenant_id IS NULL OR tenant_id = current_tenant_id());
CREATE POLICY "audit_log_select" ON audit_log
  FOR SELECT USING (tenant_id IS NULL OR tenant_id = current_tenant_id());

-- referrals: scoped to the referring tenant
CREATE POLICY "referrals_rls" ON referrals
  FOR ALL USING (referrer_tenant_id = current_tenant_id())
  WITH CHECK (referrer_tenant_id = current_tenant_id());


-- ---------------------------------------------------------------------------
-- 9. PERFORMANCE INDEXES
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_tenants_slug          ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_waba_id       ON tenants(waba_id)          WHERE waba_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tenants_whatsapp      ON tenants(whatsapp_number)  WHERE whatsapp_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_contacts_phone        ON contacts(tenant_id, phone) WHERE phone IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_conversations_status  ON conversations(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_conversations_contact ON conversations(tenant_id, contact_identifier);
CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations(tenant_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_tenant       ON messages(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_invoices_status       ON invoices(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date     ON invoices(tenant_id, due_date) WHERE status != 'paid';

CREATE INDEX IF NOT EXISTS idx_debtors_status        ON debtors(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_debtors_contact       ON debtors(tenant_id, contact_identifier);

CREATE INDEX IF NOT EXISTS idx_staff_active          ON staff(tenant_id) WHERE active = true;

CREATE INDEX IF NOT EXISTS idx_documents_status      ON documents(tenant_id, processing_status);

CREATE INDEX IF NOT EXISTS idx_audit_log_tenant      ON audit_log(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_resource    ON audit_log(resource_type, resource_id);

CREATE INDEX IF NOT EXISTS idx_business_insights     ON business_insights(tenant_id, extracted_at DESC);

CREATE INDEX IF NOT EXISTS idx_seq_next_step         ON sequence_enrollments(next_step_at) WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_calendar_date         ON calendar_events(tenant_id, event_date);
CREATE INDEX IF NOT EXISTS idx_calendar_start        ON calendar_events(tenant_id, start_at);

CREATE INDEX IF NOT EXISTS idx_wq_tenant_status      ON workflow_queue(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_wq_next_attempt       ON workflow_queue(next_attempt_at) WHERE status IN ('pending','failed');
CREATE INDEX IF NOT EXISTS idx_wq_type               ON workflow_queue(workflow_type);

CREATE INDEX IF NOT EXISTS idx_email_drafts_status   ON email_drafts(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_email_drafts_type     ON email_drafts(tenant_id, email_type);


-- ---------------------------------------------------------------------------
-- 10. TRIGGER FUNCTIONS (bugs fixed vs. previous migrations)
-- ---------------------------------------------------------------------------

-- Auto-create subscription when a new tenant registers
CREATE OR REPLACE FUNCTION create_default_subscription()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO subscriptions (tenant_id, plan, status, trial_ends_at)
  VALUES (NEW.id, 'trial', 'trialing', NOW() + INTERVAL '14 days')
  ON CONFLICT (tenant_id) DO NOTHING;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS auto_create_subscription ON tenants;
CREATE TRIGGER auto_create_subscription
  AFTER INSERT ON tenants
  FOR EACH ROW EXECUTE FUNCTION create_default_subscription();


-- Invoice due_date passes → queue debt recovery workflow
-- days_overdue is computed inline (CURRENT_DATE is not immutable → cannot be a generated column)
CREATE OR REPLACE FUNCTION fn_trigger_debt_recovery()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_days_overdue integer;
BEGIN
  IF NEW.due_date IS NOT NULL AND NEW.status != 'paid' THEN
    v_days_overdue := GREATEST(0, CURRENT_DATE - NEW.due_date);
    IF v_days_overdue > 0 AND (OLD.due_date IS NULL OR OLD.due_date >= CURRENT_DATE) THEN
      INSERT INTO workflow_queue (tenant_id, workflow_type, payload)
      VALUES (
        NEW.tenant_id,
        'debt_recovery_initiated',
        jsonb_build_object(
          'invoice_id',         NEW.id,
          'contact_identifier', NEW.contact_phone,
          'amount',             NEW.amount,
          'days_overdue',       v_days_overdue,
          'invoice_reference',  COALESCE(NEW.invoice_reference, NEW.id::text)
        )
      );
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_invoice_overdue ON invoices;
CREATE TRIGGER trg_invoice_overdue
  AFTER UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION fn_trigger_debt_recovery();


-- Document inserted/updated with processing status → queue doc pipeline
-- FIX: was using NEW.status (wrong) → now NEW.processing_status
-- FIX: was using NEW.storage_path (wrong) → now NEW.storage_url
CREATE OR REPLACE FUNCTION fn_trigger_doc_pipeline()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.processing_status = 'processing' AND
     (TG_OP = 'INSERT' OR OLD.processing_status IS DISTINCT FROM 'processing') THEN
    INSERT INTO workflow_queue (tenant_id, workflow_type, payload)
    VALUES (
      NEW.tenant_id,
      'document_uploaded',
      jsonb_build_object(
        'document_id',  NEW.id,
        'file_type',    COALESCE(NEW.file_type::text, 'unknown'),
        'storage_url',  NEW.storage_url,
        'is_reference', COALESCE(NEW.is_reference, false)
      )
    );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_document_processing ON documents;
CREATE TRIGGER trg_document_processing
  AFTER INSERT OR UPDATE OF processing_status ON documents
  FOR EACH ROW EXECUTE FUNCTION fn_trigger_doc_pipeline();


-- Staff wellness drop → burnout alert with 48-hour dedup
-- FIX: wellness_scores are {score: N, date: "ISO"} — extract score correctly
CREATE OR REPLACE FUNCTION fn_trigger_burnout_alert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  avg_score   numeric;
  score_count integer;
BEGIN
  IF NEW.wellness_scores IS NOT NULL AND jsonb_array_length(NEW.wellness_scores) >= 3 THEN
    SELECT
      AVG((item->>'score')::numeric),
      COUNT(*)
    INTO avg_score, score_count
    FROM (
      SELECT item
      FROM jsonb_array_elements(NEW.wellness_scores) AS item
      ORDER BY (item->>'date')::date DESC NULLS LAST
      LIMIT 7
    ) recent;

    IF avg_score IS NOT NULL AND avg_score < 2.5 THEN
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
        WHERE tenant_id    = NEW.tenant_id
          AND workflow_type = 'burnout_alert'
          AND payload->>'staff_id' = NEW.id::text
          AND created_at > now() - interval '48 hours'
      );
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_wellness_burnout ON staff;
CREATE TRIGGER trg_wellness_burnout
  AFTER UPDATE OF wellness_scores ON staff
  FOR EACH ROW EXECUTE FUNCTION fn_trigger_burnout_alert();


-- Contract with expiry_date → queue alert 30 days before expiry
-- FIX: was using NEW.file_name (wrong) → now NEW.original_filename
CREATE OR REPLACE FUNCTION fn_trigger_contract_expiry()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.expiry_date IS NOT NULL
     AND NEW.document_type = 'contract'
     AND (TG_OP = 'INSERT' OR OLD.expiry_date IS DISTINCT FROM NEW.expiry_date) THEN
    INSERT INTO workflow_queue (tenant_id, workflow_type, payload, next_attempt_at)
    VALUES (
      NEW.tenant_id,
      'contract_expiry_alert',
      jsonb_build_object(
        'document_id',       NEW.id,
        'document_name',     NEW.original_filename,
        'expiry_date',       NEW.expiry_date,
        'days_until_expiry', (NEW.expiry_date - CURRENT_DATE)
      ),
      GREATEST(now(), (NEW.expiry_date - INTERVAL '30 days')::timestamptz)
    );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_contract_expiry ON documents;
CREATE TRIGGER trg_contract_expiry
  AFTER INSERT OR UPDATE OF expiry_date ON documents
  FOR EACH ROW EXECUTE FUNCTION fn_trigger_contract_expiry();


-- ---------------------------------------------------------------------------
-- 11. VIEWS
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW overdue_invoices AS
  SELECT
    i.*,
    GREATEST(0, CURRENT_DATE - i.due_date) AS days_overdue,
    t.name AS tenant_name,
    t.plan AS tenant_plan
  FROM invoices i
  JOIN tenants t ON t.id = i.tenant_id
  WHERE i.status IN ('unpaid','partial')
    AND i.due_date IS NOT NULL
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
-- 12. REALTIME (wrapped — safe to re-run)
-- ---------------------------------------------------------------------------
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE conversations;    EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE messages;          EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE workflow_queue;    EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE email_drafts;      EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE document_templates; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE calendar_events;   EXCEPTION WHEN OTHERS THEN NULL; END $$;


-- ---------------------------------------------------------------------------
-- 13. STORAGE — private documents bucket
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


-- =============================================================================
-- PHASE 8-13 ADDITIONS (safe to re-run — all IF NOT EXISTS / ADD COLUMN IF NOT EXISTS)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- A. contacts — add missing columns (wa_id, source, external_id, lifetime_value)
-- ---------------------------------------------------------------------------
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS wa_id           text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS source          text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS external_id     text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS lifetime_value  numeric(12,2) DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS uq_contacts_tenant_phone
  ON contacts(tenant_id, phone) WHERE phone IS NOT NULL;

-- ---------------------------------------------------------------------------
-- B. subscriptions — add addon columns + payfast_token
-- ---------------------------------------------------------------------------
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS addon_ring                    boolean     DEFAULT false;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS addon_reach                   boolean     DEFAULT false;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS addon_sage                    boolean     DEFAULT false;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS addon_language_pack           boolean     DEFAULT false;
-- addon_languages is the canonical column name used by checkout + hub (custom_str3='languages')
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS addon_languages               boolean     DEFAULT false;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS addon_client_portal           boolean     DEFAULT false;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS payfast_token                 text;
-- addon expires columns (written by the universal PayFast hub on each renewal)
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS addon_ring_expires_at         timestamptz;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS addon_reach_expires_at        timestamptz;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS addon_sage_expires_at         timestamptz;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS addon_languages_expires_at    timestamptz;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS addon_client_portal_expires_at timestamptz;

-- ---------------------------------------------------------------------------
-- C. billing_events — payment & subscription lifecycle events
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS billing_events (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_type        text        NOT NULL,
  amount            numeric(10,2),
  payfast_reference text,
  metadata          jsonb       DEFAULT '{}',
  created_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE billing_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "billing_events_rls" ON billing_events;
CREATE POLICY "billing_events_rls" ON billing_events
  FOR ALL USING (tenant_id = current_tenant_id());

CREATE INDEX IF NOT EXISTS idx_billing_events_tenant
  ON billing_events(tenant_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- D. call_logs — Ring (Twilio Voice) call records
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS call_logs (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contact_id       uuid        REFERENCES contacts(id) ON DELETE SET NULL,
  twilio_call_sid  text        UNIQUE,
  direction        text        NOT NULL DEFAULT 'inbound',
  from_number      text        NOT NULL,
  to_number        text        NOT NULL,
  status           text        NOT NULL DEFAULT 'ringing',
  duration_sec     integer,
  recording_url    text,
  transcript       text,
  sentiment        text,
  summary          text,
  ai_handled       boolean     DEFAULT true,
  transferred_to   text,
  whatsapp_sent    boolean     DEFAULT false,
  started_at       timestamptz NOT NULL DEFAULT now(),
  ended_at         timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS call_logs_updated_at ON call_logs;
CREATE TRIGGER call_logs_updated_at
  BEFORE UPDATE ON call_logs FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "call_logs_rls" ON call_logs;
CREATE POLICY "call_logs_rls" ON call_logs
  FOR ALL USING (tenant_id = current_tenant_id());

CREATE INDEX IF NOT EXISTS idx_call_logs_tenant
  ON call_logs(tenant_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_logs_contact
  ON call_logs(tenant_id, contact_id);

-- ---------------------------------------------------------------------------
-- E. broadcast_campaigns — Reach campaign table (if not already created)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS broadcast_campaigns (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name             text        NOT NULL,
  audience_filter  jsonb       DEFAULT '{}',
  message_template text        NOT NULL,
  template_name    text,
  scheduled_at     timestamptz,
  sent_at          timestamptz,
  status           text        NOT NULL DEFAULT 'draft',
  sent_count       integer     DEFAULT 0,
  delivered_count  integer     DEFAULT 0,
  failed_count     integer     DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS broadcast_campaigns_updated_at ON broadcast_campaigns;
CREATE TRIGGER broadcast_campaigns_updated_at
  BEFORE UPDATE ON broadcast_campaigns FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE broadcast_campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "broadcast_campaigns_rls" ON broadcast_campaigns;
CREATE POLICY "broadcast_campaigns_rls" ON broadcast_campaigns
  FOR ALL USING (tenant_id = current_tenant_id());

CREATE INDEX IF NOT EXISTS idx_broadcast_campaigns_tenant
  ON broadcast_campaigns(tenant_id, created_at DESC);

-- campaign_sends — per-contact delivery tracking
CREATE TABLE IF NOT EXISTS campaign_sends (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  campaign_id    uuid        NOT NULL REFERENCES broadcast_campaigns(id) ON DELETE CASCADE,
  contact_id     uuid        REFERENCES contacts(id) ON DELETE SET NULL,
  phone          text        NOT NULL,
  status         text        NOT NULL DEFAULT 'pending',
  wa_message_id  text,
  sent_at        timestamptz,
  error          text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE campaign_sends ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "campaign_sends_rls" ON campaign_sends;
CREATE POLICY "campaign_sends_rls" ON campaign_sends
  FOR ALL USING (tenant_id = current_tenant_id());

CREATE INDEX IF NOT EXISTS idx_campaign_sends_campaign
  ON campaign_sends(campaign_id, status);
CREATE INDEX IF NOT EXISTS idx_campaign_sends_tenant
  ON campaign_sends(tenant_id);

-- ---------------------------------------------------------------------------
-- F. portal_sessions — Client Self-Service Portal (Phase 13)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS portal_sessions (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contact_identifier text       NOT NULL,
  token             text        NOT NULL UNIQUE,
  expires_at        timestamptz NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  revoked_at        timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE portal_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "portal_sessions_rls" ON portal_sessions;
CREATE POLICY "portal_sessions_rls" ON portal_sessions
  FOR ALL USING (tenant_id = current_tenant_id());

CREATE INDEX IF NOT EXISTS idx_portal_sessions_token
  ON portal_sessions(token) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_portal_sessions_tenant
  ON portal_sessions(tenant_id);

-- Realtime for call_logs (Ring live updates)
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE call_logs; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE broadcast_campaigns; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- E. payment_events — full PayFast ITN audit trail (written by universal hub)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payment_events (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_type      text        NOT NULL,  -- 'payfast.complete' | 'payfast.subscr_payment' | 'payfast.cancelled'
  payfast_pf_id   text,
  payfast_token   text,
  m_payment_id    text,
  amount          numeric(10,2),
  plan            text,
  payload         jsonb       DEFAULT '{}',
  processed       boolean     DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE payment_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payment_events_rls" ON payment_events;
CREATE POLICY "payment_events_rls" ON payment_events
  FOR ALL USING (tenant_id = current_tenant_id());

CREATE INDEX IF NOT EXISTS idx_payment_events_tenant
  ON payment_events(tenant_id, created_at DESC);

-- =============================================================================
-- DONE ✓
--
-- Tables (27):  tenants, contacts, conversations, messages, staff,
--               leave_requests, invoices, debtors, documents, goals,
--               calendar_events, audit_log, subscriptions, business_insights,
--               whatsapp_sequences, sequence_enrollments, referrals,
--               workflow_queue, document_templates, email_drafts,
--               billing_events, call_logs, broadcast_campaigns, campaign_sends,
--               portal_sessions, payment_events
--               (+ contacts/subscriptions column additions)
--
-- Policies:     All tables with tenant_id isolation
-- =============================================================================
