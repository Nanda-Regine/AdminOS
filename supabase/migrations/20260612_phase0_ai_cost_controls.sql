-- Phase 0.3 — AI Cost Controls
-- Token usage logging, per-tenant budget table, rate-limit overrides

-- Granular log of every AI call: token counts, model, feature, cost
CREATE TABLE IF NOT EXISTS ai_usage_logs (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id   UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  feature     TEXT        NOT NULL,
  model       TEXT        NOT NULL,
  tokens_in   INT         NOT NULL DEFAULT 0,
  tokens_out  INT         NOT NULL DEFAULT 0,
  cost_usd    NUMERIC(10,6) DEFAULT 0,
  duration_ms INT,
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX ai_usage_logs_tenant_date_idx ON ai_usage_logs (tenant_id, created_at DESC);
CREATE INDEX ai_usage_logs_feature_idx     ON ai_usage_logs (feature, created_at DESC);

ALTER TABLE ai_usage_logs ENABLE ROW LEVEL SECURITY;

-- Owners can see their own tenant's usage (for billing transparency)
CREATE POLICY "ai_usage_tenant_read" ON ai_usage_logs
  FOR SELECT USING (tenant_id = (auth.jwt() -> 'tenant_id')::uuid);

-- Only service role can insert (all writes go through supabaseAdmin)
-- No INSERT policy needed — service role bypasses RLS

-- Per-tenant cost budget configuration
-- Seeded automatically on tenant creation (see onboarding)
CREATE TABLE IF NOT EXISTS ai_cost_budgets (
  tenant_id           UUID        PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  plan                TEXT        NOT NULL DEFAULT 'trial',
  daily_token_limit   INT         NOT NULL DEFAULT 25000,
  monthly_cost_cap_zar NUMERIC(10,2),
  budget_override     INT,    -- super-admin can raise/lower individual tenant budget
  updated_at          TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE ai_cost_budgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_cost_budgets_owner_read" ON ai_cost_budgets
  FOR SELECT USING (tenant_id = (auth.jwt() -> 'tenant_id')::uuid);

-- Per-tenant, per-feature rate-limit overrides
-- Allows super-admin to throttle or boost specific features for specific tenants
CREATE TABLE IF NOT EXISTS rate_limit_overrides (
  id                UUID  DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id         UUID  NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  feature           TEXT  NOT NULL,
  requests_per_hour INT   NOT NULL,
  updated_at        TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE (tenant_id, feature)
);

ALTER TABLE rate_limit_overrides ENABLE ROW LEVEL SECURITY;
-- No user-facing policy needed — only super-admin (service role) manages these
