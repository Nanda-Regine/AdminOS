-- Phase 11 — Plan Management, Add-ons, Special Pricing
-- Tracks tenant plan history, add-on subscriptions, and special pricing programmes

-- ─── Plan Change History ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS plan_changes (
  id               UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id        UUID    NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  previous_plan    TEXT,
  new_plan         TEXT    NOT NULL,
  reason           TEXT,
  changed_by       UUID    REFERENCES auth.users(id),
  payfast_token    TEXT,
  effective_date   DATE    NOT NULL DEFAULT CURRENT_DATE,
  created_at       TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE plan_changes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plan_changes_tenant" ON plan_changes
  USING (tenant_id = (SELECT user_metadata->>'tenant_id' FROM auth.users WHERE id = auth.uid())::UUID);

-- ─── Add-Ons ──────────────────────────────────────────────────────────────────
-- Add-on subscriptions for individual features purchased on top of base plan

CREATE TABLE IF NOT EXISTS addon_subscriptions (
  id               UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id        UUID    NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  addon_slug       TEXT    NOT NULL,
  -- Valid slugs: whatsapp_extra, ai_languages, payroll_module, booking_engine,
  --              esignature, social_inbox, white_label, extra_staff_5
  status           TEXT    NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','cancelled','suspended','trial')),
  payfast_token    TEXT,
  quantity         INT     NOT NULL DEFAULT 1,
  price_per_unit   NUMERIC(10,2),
  billing_cycle    TEXT    NOT NULL DEFAULT 'monthly'
    CHECK (billing_cycle IN ('monthly','annual')),
  started_at       TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  expires_at       TIMESTAMPTZ,
  cancelled_at     TIMESTAMPTZ,
  UNIQUE (tenant_id, addon_slug)
);

ALTER TABLE addon_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "addons_tenant" ON addon_subscriptions
  USING (tenant_id = (SELECT user_metadata->>'tenant_id' FROM auth.users WHERE id = auth.uid())::UUID);

-- ─── Special Pricing Programmes ───────────────────────────────────────────────
-- Verified applicants get discounted rates: NPO, Youth, Township, Women-owned, NGO

CREATE TABLE IF NOT EXISTS special_pricing_applications (
  id                    UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id             UUID    NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  programme             TEXT    NOT NULL
    CHECK (programme IN ('npo_nonprofit','youth_owned','township_rural','women_owned','refugee_entrepreneur')),
  status                TEXT    NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected','expired')),
  supporting_documents  TEXT[]  DEFAULT ARRAY[]::TEXT[],  -- URLs of verification docs
  discount_pct          NUMERIC(5,2),
  applied_at            TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  reviewed_at           TIMESTAMPTZ,
  reviewed_by           UUID    REFERENCES auth.users(id),  -- admin user
  rejection_reason      TEXT,
  expires_at            DATE,
  UNIQUE (tenant_id, programme)
);

ALTER TABLE special_pricing_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "special_pricing_tenant" ON special_pricing_applications
  USING (tenant_id = (SELECT user_metadata->>'tenant_id' FROM auth.users WHERE id = auth.uid())::UUID);

-- ─── Plan Pricing Catalogue ───────────────────────────────────────────────────
-- Reference table for plan prices and features (managed by super-admin only)

CREATE TABLE IF NOT EXISTS plan_catalogue (
  slug             TEXT    PRIMARY KEY,
  display_name     TEXT    NOT NULL,
  price_monthly    NUMERIC(10,2) NOT NULL,
  price_annual     NUMERIC(10,2),
  max_staff        INT,
  max_conversations_monthly INT,
  max_ai_tokens_monthly     BIGINT,
  features         JSONB   DEFAULT '[]',
  active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- No RLS on plan_catalogue — read by all; writes restricted to service role
INSERT INTO plan_catalogue (slug, display_name, price_monthly, price_annual, max_staff, max_conversations_monthly, max_ai_tokens_monthly) VALUES
  ('solo',    'Solo',    349,  3490,  1,   100,  50000),
  ('grow',    'Grow',    899,  8990,  5,   500,  200000),
  ('operate', 'Operate', 1999, 19990, 20,  2000, 800000),
  ('scale',   'Scale',   3999, 39990, 100, null, 3000000),
  ('partner', 'Partner', 9999, 99990, null, null, null)
ON CONFLICT (slug) DO NOTHING;

-- ─── Add-On Catalogue ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS addon_catalogue (
  slug           TEXT    PRIMARY KEY,
  display_name   TEXT    NOT NULL,
  description    TEXT,
  price_monthly  NUMERIC(10,2) NOT NULL,
  price_annual   NUMERIC(10,2),
  active         BOOLEAN NOT NULL DEFAULT TRUE
);

INSERT INTO addon_catalogue (slug, display_name, description, price_monthly) VALUES
  ('whatsapp_extra',   'Extra WhatsApp Number',  'Add a second WhatsApp business number',        199),
  ('ai_languages',     'AI Languages Pack',      'isiZulu, Sesotho, Xhosa, Afrikaans AI responses', 149),
  ('payroll_module',   'Payroll Module',         'Full payroll + PAYE/UIF/SDL (SOLO plan only)',  299),
  ('booking_engine',   'Booking Engine',         'Online booking widget for your website',        199),
  ('esignature',       'eSignature',             'Legally binding digital signatures (ECTA)',     149),
  ('social_inbox',     'Social Inbox',           'Facebook, Instagram, Google Reviews unified',   249),
  ('white_label',      'White Label',            'Remove AdminOS branding (PARTNER only)',         999),
  ('extra_staff_5',    '+5 Staff Seats',         'Add 5 additional staff seats to your plan',    199)
ON CONFLICT (slug) DO NOTHING;
