-- Phase 2 — Business Health Score + Sector Benchmarks

CREATE TABLE IF NOT EXISTS business_health_snapshots (
  id                    UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id             UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  snapshot_date         DATE        NOT NULL DEFAULT CURRENT_DATE,
  overall_score         NUMERIC(5,2),
  financial_health      NUMERIC(5,2),
  legal_compliance      NUMERIC(5,2),
  people_management     NUMERIC(5,2),
  customer_relations    NUMERIC(5,2),
  operational_maturity  NUMERIC(5,2),
  strategic_readiness   NUMERIC(5,2),
  dimension_details     JSONB,
  created_at            TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE (tenant_id, snapshot_date)
);

CREATE INDEX health_snapshots_tenant_date_idx ON business_health_snapshots (tenant_id, snapshot_date DESC);

ALTER TABLE business_health_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "health_snapshots_tenant" ON business_health_snapshots
  USING (tenant_id = (auth.jwt() -> 'tenant_id')::uuid);

-- Sector benchmarks for comparison (populated by cron job — not tenant-scoped)
CREATE TABLE IF NOT EXISTS sector_benchmarks (
  id            UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  business_type TEXT    NOT NULL,
  metric_name   TEXT    NOT NULL,
  value_p25     NUMERIC,
  value_p50     NUMERIC,
  value_p75     NUMERIC,
  province      TEXT,
  revenue_tier  TEXT,
  sample_size   INT,
  calculated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE (business_type, metric_name, province, revenue_tier)
);

-- Public read — benchmarks are aggregate/anonymous, no PII
ALTER TABLE sector_benchmarks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "benchmarks_public_read" ON sector_benchmarks
  FOR SELECT USING (true);

-- Realtime subscription for live health score updates on dashboard
ALTER PUBLICATION supabase_realtime ADD TABLE business_health_snapshots;
