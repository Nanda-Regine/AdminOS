-- Phase 9–11 — Advanced Features
-- Business valuation, Social inbox, Branches, KB, Impact Dashboard, Widget

-- ─── Business Valuation ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS valuation_snapshots (
  id                     UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id              UUID    NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  snapshot_date          DATE    NOT NULL DEFAULT CURRENT_DATE,
  -- Revenue multiple
  revenue_multiple_value NUMERIC(12,2),
  revenue_multiple_used  NUMERIC(5,2),
  -- EBITDA multiple
  ebitda_value           NUMERIC(12,2),
  ebitda_multiple_used   NUMERIC(5,2),
  -- Combined
  estimated_value        NUMERIC(12,2),
  -- Exit readiness (Built to Sell — 5 criteria, scored 0–20 each)
  exit_score             NUMERIC(5,2),
  exit_details           JSONB  DEFAULT '{}',
  -- Sector
  sector                 TEXT,
  revenue_ttm            NUMERIC(12,2),
  ebitda_ttm             NUMERIC(12,2),
  created_at             TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE (tenant_id, snapshot_date)
);

ALTER TABLE valuation_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "valuation_snapshots_tenant" ON valuation_snapshots
  USING (tenant_id = (SELECT user_metadata->>'tenant_id' FROM auth.users WHERE id = auth.uid())::UUID);

-- ─── Social Inbox ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS social_accounts (
  id            UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id     UUID    NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  platform      TEXT    NOT NULL
    CHECK (platform IN ('facebook','instagram','google_reviews','twitter','linkedin')),
  account_id    TEXT,
  account_name  TEXT,
  access_token  TEXT,
  connected_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE (tenant_id, platform, account_id)
);

ALTER TABLE social_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "social_accounts_tenant" ON social_accounts
  USING (tenant_id = (SELECT user_metadata->>'tenant_id' FROM auth.users WHERE id = auth.uid())::UUID);

CREATE TABLE IF NOT EXISTS social_messages (
  id                  UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id           UUID    NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  platform            TEXT    NOT NULL,
  external_message_id TEXT,
  sender_name         TEXT,
  sender_id           TEXT,
  content             TEXT,
  message_type        TEXT    CHECK (message_type IN ('dm','comment','review','mention')),
  sentiment           TEXT    CHECK (sentiment IN ('positive','neutral','negative')),
  replied_at          TIMESTAMPTZ,
  reply_content       TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE (platform, external_message_id)
);

ALTER TABLE social_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "social_messages_tenant" ON social_messages
  USING (tenant_id = (SELECT user_metadata->>'tenant_id' FROM auth.users WHERE id = auth.uid())::UUID);

-- ─── Branches ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS branches (
  id               UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id        UUID    NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name             TEXT    NOT NULL,
  address          TEXT,
  whatsapp_number  TEXT,
  manager_user_id  UUID    REFERENCES auth.users(id),
  timezone         TEXT    NOT NULL DEFAULT 'Africa/Johannesburg',
  active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "branches_tenant" ON branches
  USING (tenant_id = (SELECT user_metadata->>'tenant_id' FROM auth.users WHERE id = auth.uid())::UUID);

-- ─── Knowledge Base ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS kb_categories (
  id           UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id    UUID    NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name         TEXT    NOT NULL,
  icon         TEXT,
  order_index  INT     NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE kb_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kb_categories_tenant" ON kb_categories
  USING (tenant_id = (SELECT user_metadata->>'tenant_id' FROM auth.users WHERE id = auth.uid())::UUID);

CREATE TABLE IF NOT EXISTS kb_articles (
  id            UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id     UUID    NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  category_id   UUID    REFERENCES kb_categories(id) ON DELETE SET NULL,
  title         TEXT    NOT NULL,
  content       TEXT    NOT NULL,
  tags          TEXT[]  DEFAULT ARRAY[]::TEXT[],
  published     BOOLEAN NOT NULL DEFAULT TRUE,
  view_count    INT     NOT NULL DEFAULT 0,
  helpful_count INT     NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE kb_articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kb_articles_tenant" ON kb_articles
  USING (tenant_id = (SELECT user_metadata->>'tenant_id' FROM auth.users WHERE id = auth.uid())::UUID);

CREATE INDEX kb_articles_search_idx ON kb_articles USING GIN (to_tsvector('english', title || ' ' || content));

-- ─── Impact Snapshots ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS impact_snapshots (
  id                              UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  snapshot_date                   DATE    NOT NULL DEFAULT CURRENT_DATE UNIQUE,
  total_businesses                INT     NOT NULL DEFAULT 0,
  active_businesses               INT     NOT NULL DEFAULT 0,
  total_staff_on_platform         INT     NOT NULL DEFAULT 0,
  jobs_protected_estimate         INT     NOT NULL DEFAULT 0,
  businesses_formalised           INT     NOT NULL DEFAULT 0,
  women_owned_businesses          INT     NOT NULL DEFAULT 0,
  township_rural_businesses       INT     NOT NULL DEFAULT 0,
  total_debt_recovered_zar        NUMERIC(15,2) NOT NULL DEFAULT 0,
  compliance_violations_prevented INT     NOT NULL DEFAULT 0,
  active_languages                INT     NOT NULL DEFAULT 1,
  provinces_covered               INT     NOT NULL DEFAULT 0,
  ngo_nonprofit_count             INT     NOT NULL DEFAULT 0,
  youth_owned_count               INT     NOT NULL DEFAULT 0,
  stokvel_groups_count            INT     NOT NULL DEFAULT 0,
  informal_pathway_completions    INT     NOT NULL DEFAULT 0,
  academy_certificates_issued     INT     NOT NULL DEFAULT 0,
  mentorship_connections          INT     NOT NULL DEFAULT 0,
  created_at                      TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ─── Contextual Coaching Cards ────────────────────────────────────────────────
-- Pre-action guidance surfaced before destructive / high-risk operations

CREATE TABLE IF NOT EXISTS coaching_cards (
  id               UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  trigger_action   TEXT    NOT NULL UNIQUE,  -- e.g. 'dismissal.initiate'
  title            TEXT    NOT NULL,
  body             TEXT    NOT NULL,
  severity         TEXT    NOT NULL DEFAULT 'info'
    CHECK (severity IN ('info','warning','critical')),
  checklist        JSONB   DEFAULT '[]',     -- items to confirm before proceeding
  academy_lesson   TEXT,                     -- lesson slug to link
  framework_slug   TEXT    REFERENCES framework_library(slug),
  created_at       TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Seed critical coaching cards
INSERT INTO coaching_cards (trigger_action, title, body, severity, checklist, academy_lesson) VALUES
('dismissal.initiate',
 'Have you followed the LRA process?',
 'Dismissal without a fair reason AND a fair procedure is automatically unfair dismissal under the Labour Relations Act. The CCMA will scrutinise both.',
 'critical',
 '[{"item": "Employee received written notice of the hearing with charges listed", "required": true}, {"item": "Notice gave at least 24 hours before the hearing", "required": true}, {"item": "Employee was informed of their right to representation", "required": true}, {"item": "Hearing was held and employee had a chance to respond", "required": true}, {"item": "Written outcome with reasons was issued", "required": true}]',
 null),

('probation.extend',
 'Probation extension limits',
 'The CCMA views long probation extensions as unfair labour practice. Probation should be long enough to evaluate performance — not a permanent tool to delay permanent employment.',
 'warning',
 '[{"item": "Is the extension for a documented performance reason?", "required": true}, {"item": "Is the total probation period reasonable for the role complexity?", "required": true}, {"item": "Has the employee been given feedback and a chance to improve?", "required": true}]',
 null),

('final_demand.send',
 'NCA Section 129 — required before legal action',
 'The National Credit Act requires a Section 129 notice be delivered to the consumer before commencing legal action on credit agreements. Failure to send it means your legal action may be dismissed.',
 'warning',
 '[{"item": "Is this debt subject to the NCA (i.e. is it a credit agreement)?", "required": false}, {"item": "Section 129 notice has been sent by registered post or email", "required": false}]',
 null),

('contract.sign_without_expiry',
 'Contracts without end dates become perpetual obligations',
 'A contract with no end date or review date can bind you indefinitely. At minimum, add an annual review clause.',
 'info',
 '[{"item": "Added an end date or review clause", "required": false}, {"item": "Termination provisions are clearly stated", "required": false}]',
 null),

('vat.cross_threshold',
 'VAT registration deadline: 21 business days',
 'Once your taxable supplies in any consecutive 12-month period exceed R1,000,000, you have 21 business days to register for VAT. SARS will backdate liability to the date you crossed the threshold if you fail to register.',
 'critical',
 '[{"item": "Filed VAT101 registration on SARS eFiling", "required": true}, {"item": "Updated all invoices to include VAT number and 15% VAT", "required": true}]',
 null)
ON CONFLICT (trigger_action) DO NOTHING;
