-- Phase 7 — Ubuntu & Community Layer
-- Stokvel, Mentorship, Community, Informal-to-Formal, B-BBEE tracking

-- ─── Stokvel ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS stokvel_groups (
  id                  UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id           UUID    NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name                TEXT    NOT NULL,
  contribution_amount NUMERIC(12,2) NOT NULL,
  frequency           TEXT    NOT NULL DEFAULT 'monthly'
    CHECK (frequency IN ('weekly','fortnightly','monthly')),
  payout_order        TEXT    NOT NULL DEFAULT 'rotation'
    CHECK (payout_order IN ('rotation','lottery','fixed')),
  start_date          DATE,
  status              TEXT    NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','paused','closed')),
  rules               TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE stokvel_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stokvel_groups_tenant" ON stokvel_groups
  USING (tenant_id = (SELECT user_metadata->>'tenant_id' FROM auth.users WHERE id = auth.uid())::UUID);

CREATE TABLE IF NOT EXISTS stokvel_members (
  id              UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id        UUID    NOT NULL REFERENCES stokvel_groups(id) ON DELETE CASCADE,
  tenant_id       UUID    NOT NULL REFERENCES tenants(id)        ON DELETE CASCADE,
  name            TEXT    NOT NULL,
  phone           TEXT    NOT NULL,
  payout_position INT,
  joined_at       TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE stokvel_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stokvel_members_tenant" ON stokvel_members
  USING (tenant_id = (SELECT user_metadata->>'tenant_id' FROM auth.users WHERE id = auth.uid())::UUID);

CREATE TABLE IF NOT EXISTS stokvel_contributions (
  id            UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id      UUID    NOT NULL REFERENCES stokvel_groups(id)  ON DELETE CASCADE,
  member_id     UUID    NOT NULL REFERENCES stokvel_members(id) ON DELETE CASCADE,
  period_month  INT     NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  period_year   INT     NOT NULL,
  amount        NUMERIC(12,2) NOT NULL,
  status        TEXT    NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','paid','late','excused')),
  paid_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE (group_id, member_id, period_month, period_year)
);

ALTER TABLE stokvel_contributions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stokvel_contributions_group" ON stokvel_contributions
  USING (group_id IN (
    SELECT id FROM stokvel_groups
    WHERE tenant_id = (SELECT user_metadata->>'tenant_id' FROM auth.users WHERE id = auth.uid())::UUID
  ));

-- ─── Mentorship ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS mentor_connections (
  id                UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  mentor_tenant_id  UUID    NOT NULL REFERENCES tenants(id),
  mentee_tenant_id  UUID    NOT NULL REFERENCES tenants(id),
  status            TEXT    NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','active','completed','declined')),
  focus_areas       TEXT[]  DEFAULT ARRAY[]::TEXT[],
  started_at        TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE mentor_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mentor_connections_participant" ON mentor_connections
  USING (
    mentor_tenant_id = (SELECT user_metadata->>'tenant_id' FROM auth.users WHERE id = auth.uid())::UUID
    OR
    mentee_tenant_id = (SELECT user_metadata->>'tenant_id' FROM auth.users WHERE id = auth.uid())::UUID
  );

-- ─── Community Posts ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS community_posts (
  id            UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id     UUID    NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  category      TEXT    NOT NULL
    CHECK (category IN ('need_help','can_help','experience','supplier_review','celebration')),
  title         TEXT    NOT NULL,
  body          TEXT    NOT NULL,
  anonymous     BOOLEAN NOT NULL DEFAULT FALSE,
  sector        TEXT,
  province      TEXT,
  replies_count INT     NOT NULL DEFAULT 0,
  helpful_count INT     NOT NULL DEFAULT 0,
  status        TEXT    NOT NULL DEFAULT 'active',
  created_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE community_posts ENABLE ROW LEVEL SECURITY;
-- All authenticated users can read community posts
CREATE POLICY "community_posts_read" ON community_posts FOR SELECT USING (status = 'active');
CREATE POLICY "community_posts_own"   ON community_posts FOR INSERT
  WITH CHECK (tenant_id = (SELECT user_metadata->>'tenant_id' FROM auth.users WHERE id = auth.uid())::UUID);

-- ─── Informal-to-Formal Pathway ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS formalization_progress (
  tenant_id                UUID    PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  cipc_registered          BOOLEAN NOT NULL DEFAULT FALSE,
  cipc_number              TEXT,
  sars_registered          BOOLEAN NOT NULL DEFAULT FALSE,
  sars_reference           TEXT,
  vat_registered           BOOLEAN NOT NULL DEFAULT FALSE,
  vat_number               TEXT,
  business_account_opened  BOOLEAN NOT NULL DEFAULT FALSE,
  first_contract_signed    BOOLEAN NOT NULL DEFAULT FALSE,
  first_invoice_sent       BOOLEAN NOT NULL DEFAULT FALSE,
  first_employee_hired     BOOLEAN NOT NULL DEFAULT FALSE,
  uif_registered           BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at             TIMESTAMPTZ,
  updated_at               TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE formalization_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "formalization_own" ON formalization_progress
  USING (tenant_id = (SELECT user_metadata->>'tenant_id' FROM auth.users WHERE id = auth.uid())::UUID);

-- Auto-create formalization_progress row on new tenant
CREATE OR REPLACE FUNCTION create_formalization_progress()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO formalization_progress (tenant_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_tenant_created_formalization'
  ) THEN
    CREATE TRIGGER on_tenant_created_formalization
    AFTER INSERT ON tenants FOR EACH ROW
    EXECUTE FUNCTION create_formalization_progress();
  END IF;
END $$;

-- Back-fill for existing tenants
INSERT INTO formalization_progress (tenant_id)
SELECT id FROM tenants
ON CONFLICT DO NOTHING;
