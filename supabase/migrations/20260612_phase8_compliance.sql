-- Phase 8 — Compliance Automation Suite
-- Compliance calendar, professional licenses, employment equity, health & safety

-- ─── Compliance Items ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS compliance_items (
  id                   UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id            UUID    NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  item_type            TEXT    NOT NULL,
  title                TEXT    NOT NULL,
  description          TEXT,
  due_date             DATE,
  recurrence           TEXT,
  status               TEXT    NOT NULL DEFAULT 'upcoming'
    CHECK (status IN ('upcoming','due','overdue','completed','not_applicable')),
  completed_at         TIMESTAMPTZ,
  document_id          UUID    REFERENCES documents(id) ON DELETE SET NULL,
  penalty_description  TEXT,
  guidance_module      TEXT,
  created_at           TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE compliance_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "compliance_items_tenant" ON compliance_items
  USING (tenant_id = (SELECT user_metadata->>'tenant_id' FROM auth.users WHERE id = auth.uid())::UUID);

CREATE INDEX compliance_items_tenant_due_idx ON compliance_items (tenant_id, due_date);
CREATE INDEX compliance_items_status_idx     ON compliance_items (tenant_id, status);

-- ─── Professional Licenses ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS professional_licenses (
  id                    UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id             UUID    NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  staff_id              UUID    REFERENCES staff(id)            ON DELETE SET NULL,
  license_type          TEXT    NOT NULL,
  license_number        TEXT,
  issuing_body          TEXT,
  issue_date            DATE,
  expiry_date           DATE,
  document_id           UUID    REFERENCES documents(id) ON DELETE SET NULL,
  renewal_reminder_days INT     NOT NULL DEFAULT 60,
  created_at            TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE professional_licenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "professional_licenses_tenant" ON professional_licenses
  USING (tenant_id = (SELECT user_metadata->>'tenant_id' FROM auth.users WHERE id = auth.uid())::UUID);

CREATE INDEX professional_licenses_expiry_idx ON professional_licenses (tenant_id, expiry_date);

-- ─── Employment Equity ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS employment_equity_data (
  id                    UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id             UUID    NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  reporting_year        INT     NOT NULL,
  total_workforce       INT,
  demographics          JSONB   DEFAULT '{}',
  occupational_levels   JSONB   DEFAULT '{}',
  eea2_generated_at     TIMESTAMPTZ,
  report_url            TEXT,
  UNIQUE (tenant_id, reporting_year)
);

ALTER TABLE employment_equity_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ee_data_tenant" ON employment_equity_data
  USING (tenant_id = (SELECT user_metadata->>'tenant_id' FROM auth.users WHERE id = auth.uid())::UUID);

-- ─── Health & Safety ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS safety_incidents (
  id               UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id        UUID    NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  staff_id         UUID    REFERENCES staff(id)            ON DELETE SET NULL,
  incident_date    TIMESTAMPTZ NOT NULL,
  incident_type    TEXT    NOT NULL
    CHECK (incident_type IN ('near_miss','minor_injury','major_injury','fatality','property_damage','environmental')),
  description      TEXT    NOT NULL,
  location         TEXT,
  witnesses        TEXT[],
  immediate_action TEXT,
  root_cause       TEXT,
  corrective_action TEXT,
  iod_reported     BOOLEAN NOT NULL DEFAULT FALSE,
  iod_reference    TEXT,
  documents_url    TEXT[],
  created_by       UUID    REFERENCES auth.users(id),
  created_at       TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE safety_incidents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "safety_incidents_tenant" ON safety_incidents
  USING (tenant_id = (SELECT user_metadata->>'tenant_id' FROM auth.users WHERE id = auth.uid())::UUID);

-- ─── SA Compliance Calendar Seed Function ────────────────────────────────────
-- Called on tenant creation to pre-load all SA compliance items

CREATE OR REPLACE FUNCTION seed_compliance_calendar(p_tenant_id UUID, p_financial_year_end_month INT DEFAULT 2)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_today       DATE := CURRENT_DATE;
  v_year        INT  := EXTRACT(YEAR FROM v_today)::INT;
BEGIN
  -- EMP201: monthly on 7th of following month (next 12 months)
  FOR i IN 0..11 LOOP
    INSERT INTO compliance_items (tenant_id, item_type, title, description, due_date, recurrence, penalty_description)
    VALUES (
      p_tenant_id, 'emp201',
      'EMP201 — PAYE, UIF, SDL Submission',
      'Monthly employer tax declaration and payment due to SARS',
      (date_trunc('month', v_today) + (interval '1 month' * i) + interval '37 days')::DATE,
      'monthly',
      '10% penalty per month on outstanding amount'
    ) ON CONFLICT DO NOTHING;
  END LOOP;

  -- IRP6 Provisional Tax — period 1 and 2
  INSERT INTO compliance_items (tenant_id, item_type, title, description, due_date, recurrence, penalty_description)
  VALUES
  (p_tenant_id, 'irp6_p1', 'IRP6 — Provisional Tax Period 1',
   'First provisional tax payment — 6 months into your financial year',
   (date_trunc('year', v_today) + interval '6 months')::DATE,
   'bi-annual', '20% underestimation penalty plus interest'),
  (p_tenant_id, 'irp6_p2', 'IRP6 — Provisional Tax Period 2',
   'Second provisional tax payment — at your financial year end',
   (date_trunc('year', v_today) + interval '1 year')::DATE,
   'bi-annual', '20% underestimation penalty plus interest')
  ON CONFLICT DO NOTHING;

  -- ITR14: annual corporate tax return — 12 months after year end
  INSERT INTO compliance_items (tenant_id, item_type, title, description, due_date, recurrence, penalty_description)
  VALUES (p_tenant_id, 'itr14', 'ITR14 — Company Income Tax Return',
   'Annual income tax return — due 12 months after your financial year end',
   (date_trunc('year', v_today) + interval '1 year')::DATE,
   'annual', 'Administrative penalties: R250–R16,000 per month late')
  ON CONFLICT DO NOTHING;

  -- CIPC Annual Return — approximate (anniversary-based, using today as proxy)
  INSERT INTO compliance_items (tenant_id, item_type, title, description, due_date, recurrence, penalty_description)
  VALUES (p_tenant_id, 'cipc_annual', 'CIPC Annual Return',
   'Annual company return to CIPC — due on anniversary of company registration',
   (v_today + interval '1 year')::DATE,
   'annual', 'Deregistration risk if not filed within 30 days of due date')
  ON CONFLICT DO NOTHING;

  -- COIDA: Return of Earnings — 31 March annually
  INSERT INTO compliance_items (tenant_id, item_type, title, description, due_date, recurrence, penalty_description)
  VALUES (p_tenant_id, 'coida', 'COIDA — Return of Earnings (W.As.8)',
   'Annual return of earnings to the Compensation Fund — due 31 March',
   (make_date(v_year + (CASE WHEN EXTRACT(MONTH FROM v_today) > 3 THEN 1 ELSE 0 END), 3, 31)),
   'annual', 'Penalties and employer liability for uncovered injuries')
  ON CONFLICT DO NOTHING;

  -- EMP501: Bi-annual reconciliation (31 May and 31 Oct)
  INSERT INTO compliance_items (tenant_id, item_type, title, description, due_date, recurrence, penalty_description)
  VALUES
  (p_tenant_id, 'emp501_may', 'EMP501 — Employer Reconciliation (May)',
   'Mid-year employer tax reconciliation',
   (make_date(v_year + (CASE WHEN EXTRACT(MONTH FROM v_today) > 5 THEN 1 ELSE 0 END), 5, 31)),
   'bi-annual', 'Penalties for late submission'),
  (p_tenant_id, 'emp501_oct', 'EMP501 — Employer Reconciliation (October)',
   'Annual employer tax reconciliation — IRP5 certificates issued post-submission',
   (make_date(v_year + (CASE WHEN EXTRACT(MONTH FROM v_today) > 10 THEN 1 ELSE 0 END), 10, 31)),
   'bi-annual', 'Penalties for late submission — employees cannot file their tax returns')
  ON CONFLICT DO NOTHING;
END;
$$;
