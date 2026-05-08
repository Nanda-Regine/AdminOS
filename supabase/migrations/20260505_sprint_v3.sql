-- =============================================================================
-- AdminOS Sprint V3 Migration — 2026-05-05
-- Adds: add-on billing columns, Ring/Reach/Portal tables, tenant integrations
-- Safe to re-run (uses IF NOT EXISTS / IF EXISTS guards throughout)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. tenants — add integration & geo columns
-- ---------------------------------------------------------------------------
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS meta_phone_number_id text,
  ADD COLUMN IF NOT EXISTS twilio_phone_number   text,
  ADD COLUMN IF NOT EXISTS twilio_twiml_app_sid  text,
  ADD COLUMN IF NOT EXISTS loadshedding_area_id  text,
  ADD COLUMN IF NOT EXISTS lat                   numeric(9,6),
  ADD COLUMN IF NOT EXISTS lng                   numeric(9,6);

-- ---------------------------------------------------------------------------
-- 2. contacts — add CRM enrichment columns + unique constraint
-- ---------------------------------------------------------------------------
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS source        text,
  ADD COLUMN IF NOT EXISTS external_id   text,
  ADD COLUMN IF NOT EXISTS lifetime_value numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS wa_id         text;

-- Unique constraint for upsert on (tenant_id, phone) — phone is the primary identifier
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'contacts_tenant_phone_unique'
  ) THEN
    ALTER TABLE contacts ADD CONSTRAINT contacts_tenant_phone_unique UNIQUE (tenant_id, phone)
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END $$;

-- Unique constraint for (tenant_id, wa_id) — WhatsApp ID
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'contacts_tenant_waid_unique'
  ) THEN
    ALTER TABLE contacts ADD CONSTRAINT contacts_tenant_waid_unique UNIQUE (tenant_id, wa_id)
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3. subscriptions — add add-on columns
-- ---------------------------------------------------------------------------
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS addon_ring            boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS addon_reach           boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS addon_sage            boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS addon_languages       boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS addon_client_portal   boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS addon_ring_expires_at        timestamptz,
  ADD COLUMN IF NOT EXISTS addon_reach_expires_at       timestamptz,
  ADD COLUMN IF NOT EXISTS addon_sage_expires_at        timestamptz,
  ADD COLUMN IF NOT EXISTS addon_languages_expires_at   timestamptz,
  ADD COLUMN IF NOT EXISTS addon_client_portal_expires_at timestamptz;

-- ---------------------------------------------------------------------------
-- 4. whatsapp_templates — approved Meta template library per tenant
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS whatsapp_templates (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name          text        NOT NULL,
  language_code text        NOT NULL DEFAULT 'en_ZA',
  category      text        NOT NULL DEFAULT 'MARKETING',
  components    jsonb       NOT NULL DEFAULT '[]',
  status        text        NOT NULL DEFAULT 'approved',
  meta_template_id text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name, language_code)
);
DROP TRIGGER IF EXISTS whatsapp_templates_updated_at ON whatsapp_templates;
CREATE TRIGGER whatsapp_templates_updated_at
  BEFORE UPDATE ON whatsapp_templates FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE whatsapp_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_iso_templates" ON whatsapp_templates;
CREATE POLICY "tenant_iso_templates" ON whatsapp_templates
  USING (tenant_id = current_tenant_id());

-- ---------------------------------------------------------------------------
-- 5. broadcast_campaigns — Reach agent broadcast campaigns
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS broadcast_campaigns (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name            text        NOT NULL,
  status          text        NOT NULL DEFAULT 'draft',
  channel         text        NOT NULL DEFAULT 'whatsapp',
  template_id     uuid        REFERENCES whatsapp_templates(id),
  message_body    text,
  audience_filter jsonb       NOT NULL DEFAULT '{}',
  scheduled_at    timestamptz,
  sent_at         timestamptz,
  total_recipients int        NOT NULL DEFAULT 0,
  sent_count      int         NOT NULL DEFAULT 0,
  delivered_count int         NOT NULL DEFAULT 0,
  read_count      int         NOT NULL DEFAULT 0,
  failed_count    int         NOT NULL DEFAULT 0,
  created_by      uuid        REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS broadcast_campaigns_updated_at ON broadcast_campaigns;
CREATE TRIGGER broadcast_campaigns_updated_at
  BEFORE UPDATE ON broadcast_campaigns FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_broadcast_campaigns_tenant ON broadcast_campaigns(tenant_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_campaigns_status ON broadcast_campaigns(tenant_id, status);

ALTER TABLE broadcast_campaigns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_iso_campaigns" ON broadcast_campaigns;
CREATE POLICY "tenant_iso_campaigns" ON broadcast_campaigns
  USING (tenant_id = current_tenant_id());

-- ---------------------------------------------------------------------------
-- 6. broadcast_recipients — per-contact delivery tracking
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS broadcast_recipients (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id   uuid        NOT NULL REFERENCES broadcast_campaigns(id) ON DELETE CASCADE,
  tenant_id     uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contact_id    uuid        REFERENCES contacts(id),
  phone         text        NOT NULL,
  status        text        NOT NULL DEFAULT 'pending',
  message_id    text,
  error_message text,
  sent_at       timestamptz,
  delivered_at  timestamptz,
  read_at       timestamptz,
  failed_at     timestamptz
);
CREATE INDEX IF NOT EXISTS idx_broadcast_recipients_campaign ON broadcast_recipients(campaign_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_recipients_tenant   ON broadcast_recipients(tenant_id);

ALTER TABLE broadcast_recipients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_iso_recipients" ON broadcast_recipients;
CREATE POLICY "tenant_iso_recipients" ON broadcast_recipients
  USING (tenant_id = current_tenant_id());

-- ---------------------------------------------------------------------------
-- 7. call_logs — Ring agent (Twilio voice)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS call_logs (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contact_id      uuid        REFERENCES contacts(id),
  twilio_call_sid text        UNIQUE,
  direction       text        NOT NULL DEFAULT 'inbound',
  from_number     text        NOT NULL,
  to_number       text        NOT NULL,
  status          text        NOT NULL DEFAULT 'initiated',
  duration_sec    int,
  recording_url   text,
  transcript      text,
  sentiment       text,
  summary         text,
  ai_handled      boolean     NOT NULL DEFAULT true,
  transferred_to  text,
  started_at      timestamptz NOT NULL DEFAULT now(),
  ended_at        timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_call_logs_tenant    ON call_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_contact   ON call_logs(contact_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_started   ON call_logs(tenant_id, started_at DESC);

ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_iso_call_logs" ON call_logs;
CREATE POLICY "tenant_iso_call_logs" ON call_logs
  USING (tenant_id = current_tenant_id());

-- ---------------------------------------------------------------------------
-- 8. portal_sessions — client portal magic links
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS portal_sessions (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contact_id  uuid        NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  token       text        NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at  timestamptz NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  last_accessed_at timestamptz,
  access_count int        NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_portal_sessions_token    ON portal_sessions(token) WHERE expires_at > now();
CREATE INDEX IF NOT EXISTS idx_portal_sessions_tenant   ON portal_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_portal_sessions_contact  ON portal_sessions(contact_id);

ALTER TABLE portal_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_iso_portal_sessions" ON portal_sessions;
CREATE POLICY "tenant_iso_portal_sessions" ON portal_sessions
  USING (tenant_id = current_tenant_id());

-- ---------------------------------------------------------------------------
-- 9. payment_events — PayFast webhook event log
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payment_events (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid        REFERENCES tenants(id),
  event_type      text        NOT NULL,
  payfast_pf_id   text,
  payfast_token   text,
  m_payment_id    text,
  amount          numeric(10,2),
  plan            text,
  payload         jsonb       NOT NULL DEFAULT '{}',
  processed       boolean     NOT NULL DEFAULT false,
  error_message   text,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payment_events_tenant  ON payment_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payment_events_type    ON payment_events(event_type);
CREATE INDEX IF NOT EXISTS idx_payment_events_token   ON payment_events(payfast_token) WHERE payfast_token IS NOT NULL;

ALTER TABLE payment_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "super_admin_payment_events" ON payment_events;
CREATE POLICY "super_admin_payment_events" ON payment_events
  USING (
    EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid()
        AND (u.raw_user_meta_data->>'role') = 'super_admin'
    )
  );

-- ---------------------------------------------------------------------------
-- Done
-- ---------------------------------------------------------------------------
