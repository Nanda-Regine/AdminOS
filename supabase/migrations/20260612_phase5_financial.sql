-- Phase 5 — Financial Features
-- Payroll, Cash Flow Forecasting, NPS Surveys, Loyalty

-- ─── Payroll ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS payroll_runs (
  id               UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id        UUID    NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  period_month     INT     NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  period_year      INT     NOT NULL CHECK (period_year BETWEEN 2020 AND 2099),
  status           TEXT    NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'processing', 'finalised', 'paid')),
  total_gross          NUMERIC(12,2) DEFAULT 0,
  total_deductions     NUMERIC(12,2) DEFAULT 0,
  total_net            NUMERIC(12,2) DEFAULT 0,
  total_paye           NUMERIC(12,2) DEFAULT 0,
  total_uif_employee   NUMERIC(12,2) DEFAULT 0,
  total_uif_employer   NUMERIC(12,2) DEFAULT 0,
  total_sdl            NUMERIC(12,2) DEFAULT 0,
  processed_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE (tenant_id, period_month, period_year)
);

ALTER TABLE payroll_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payroll_runs_tenant" ON payroll_runs
  USING (tenant_id = (SELECT user_metadata->>'tenant_id' FROM auth.users WHERE id = auth.uid())::UUID);

CREATE TABLE IF NOT EXISTS payslips (
  id               UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id        UUID    NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  payroll_run_id   UUID    REFERENCES payroll_runs(id) ON DELETE SET NULL,
  staff_id         UUID    NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  gross_salary         NUMERIC(12,2) NOT NULL,
  paye                 NUMERIC(12,2) DEFAULT 0,
  uif_employee         NUMERIC(12,2) DEFAULT 0,
  uif_employer         NUMERIC(12,2) DEFAULT 0,
  sdl                  NUMERIC(12,2) DEFAULT 0,
  other_deductions     JSONB   DEFAULT '[]',
  net_pay              NUMERIC(12,2) NOT NULL,
  components           JSONB   DEFAULT '[]',
  pdf_url              TEXT,
  sent_at              TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE payslips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payslips_tenant" ON payslips
  USING (tenant_id = (SELECT user_metadata->>'tenant_id' FROM auth.users WHERE id = auth.uid())::UUID);

-- ─── Cash Flow Forecasting ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cashflow_forecasts (
  id                     UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id              UUID    NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  forecast_date          DATE    NOT NULL DEFAULT CURRENT_DATE,
  forecast_horizon_days  INT     NOT NULL DEFAULT 90,
  projected_inflows      JSONB   NOT NULL DEFAULT '[]',
  projected_outflows     JSONB   NOT NULL DEFAULT '[]',
  net_by_week            JSONB   NOT NULL DEFAULT '[]',
  lowest_point           NUMERIC(12,2),
  lowest_point_date      DATE,
  risk_level             TEXT    CHECK (risk_level IN ('safe', 'watch', 'critical')),
  opening_balance        NUMERIC(12,2) DEFAULT 0,
  closing_balance        NUMERIC(12,2) DEFAULT 0,
  generated_at           TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE (tenant_id, forecast_date)
);

ALTER TABLE cashflow_forecasts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cashflow_forecasts_tenant" ON cashflow_forecasts
  USING (tenant_id = (SELECT user_metadata->>'tenant_id' FROM auth.users WHERE id = auth.uid())::UUID);

-- ─── NPS Surveys ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS nps_surveys (
  id             UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id      UUID    NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contact_id     UUID    REFERENCES contacts(id) ON DELETE SET NULL,
  trigger_type   TEXT,
  sent_at        TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  responded_at   TIMESTAMPTZ,
  score          INT     CHECK (score BETWEEN 0 AND 10),
  comment        TEXT,
  channel        TEXT    NOT NULL DEFAULT 'whatsapp'
    CHECK (channel IN ('whatsapp', 'email', 'sms', 'in_app')),
  survey_token   TEXT    UNIQUE DEFAULT gen_random_uuid()::TEXT NOT NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE nps_surveys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nps_surveys_tenant" ON nps_surveys
  USING (tenant_id = (SELECT user_metadata->>'tenant_id' FROM auth.users WHERE id = auth.uid())::UUID);

CREATE INDEX nps_surveys_tenant_idx  ON nps_surveys (tenant_id, sent_at DESC);
CREATE INDEX nps_surveys_contact_idx ON nps_surveys (contact_id);

-- ─── Loyalty Programmes ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS loyalty_programmes (
  id               UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id        UUID    NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name             TEXT    NOT NULL,
  point_value_zar  NUMERIC(8,2) NOT NULL DEFAULT 0.01,
  earn_rules       JSONB   NOT NULL DEFAULT '{}',
  redeem_rules     JSONB   NOT NULL DEFAULT '{}',
  active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE loyalty_programmes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "loyalty_programmes_tenant" ON loyalty_programmes
  USING (tenant_id = (SELECT user_metadata->>'tenant_id' FROM auth.users WHERE id = auth.uid())::UUID);

CREATE TABLE IF NOT EXISTS loyalty_points (
  id               UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id        UUID    NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contact_id       UUID    NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  programme_id     UUID    REFERENCES loyalty_programmes(id) ON DELETE SET NULL,
  transaction_type TEXT    NOT NULL
    CHECK (transaction_type IN ('earn', 'redeem', 'expire', 'adjust')),
  points           INT     NOT NULL,
  balance          INT     NOT NULL,
  reference        TEXT,
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE loyalty_points ENABLE ROW LEVEL SECURITY;
CREATE POLICY "loyalty_points_tenant" ON loyalty_points
  USING (tenant_id = (SELECT user_metadata->>'tenant_id' FROM auth.users WHERE id = auth.uid())::UUID);

CREATE INDEX loyalty_points_contact_idx ON loyalty_points (contact_id, created_at DESC);

-- ─── Profit First Settings ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS profit_first_config (
  id                  UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id           UUID    NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  income_account      TEXT,
  profit_account      TEXT,
  owner_pay_account   TEXT,
  tax_account         TEXT,
  opex_account        TEXT,
  profit_pct          NUMERIC(5,2) NOT NULL DEFAULT 1,
  owner_pay_pct       NUMERIC(5,2) NOT NULL DEFAULT 50,
  tax_pct             NUMERIC(5,2) NOT NULL DEFAULT 15,
  opex_pct            NUMERIC(5,2) NOT NULL DEFAULT 34,
  transfer_days       INT[]   NOT NULL DEFAULT ARRAY[10, 25],
  setup_complete      BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at          TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE profit_first_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profit_first_config_tenant" ON profit_first_config
  USING (tenant_id = (SELECT user_metadata->>'tenant_id' FROM auth.users WHERE id = auth.uid())::UUID);

-- ─── Realtime ────────────────────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE payroll_runs;
ALTER PUBLICATION supabase_realtime ADD TABLE cashflow_forecasts;
