-- Phase 6 — Operations Suite
-- Tasks & Projects, SOPs, Inventory, Bookings, eSignature, Suppliers

-- ─── Tasks & Projects ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS projects (
  id           UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id    UUID    NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contact_id   UUID    REFERENCES contacts(id) ON DELETE SET NULL,
  name         TEXT    NOT NULL,
  description  TEXT,
  status       TEXT    NOT NULL DEFAULT 'active'
    CHECK (status IN ('draft','active','on_hold','completed','cancelled')),
  start_date   DATE,
  due_date     DATE,
  budget       NUMERIC(12,2),
  progress_pct NUMERIC(5,2) DEFAULT 0,
  created_by   UUID    REFERENCES auth.users(id),
  created_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "projects_tenant" ON projects
  USING (tenant_id = (SELECT user_metadata->>'tenant_id' FROM auth.users WHERE id = auth.uid())::UUID);

CREATE TABLE IF NOT EXISTS tasks (
  id           UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id    UUID    NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id   UUID    REFERENCES projects(id)   ON DELETE SET NULL,
  contact_id   UUID    REFERENCES contacts(id)   ON DELETE SET NULL,
  invoice_id   UUID    REFERENCES invoices(id)   ON DELETE SET NULL,
  document_id  UUID    REFERENCES documents(id)  ON DELETE SET NULL,
  title        TEXT    NOT NULL,
  description  TEXT,
  assigned_to  UUID    REFERENCES auth.users(id),
  status       TEXT    NOT NULL DEFAULT 'todo'
    CHECK (status IN ('todo','in_progress','review','done','cancelled')),
  priority     TEXT    NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('urgent','high','medium','low')),
  due_date     TIMESTAMPTZ,
  source       TEXT    NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual','agent_chase','agent_care','agent_compliance','document_expiry','contract_expiry','payroll','onboarding')),
  created_by   UUID    REFERENCES auth.users(id),
  completed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tasks_tenant" ON tasks
  USING (tenant_id = (SELECT user_metadata->>'tenant_id' FROM auth.users WHERE id = auth.uid())::UUID);

CREATE INDEX tasks_tenant_status_idx ON tasks (tenant_id, status);
CREATE INDEX tasks_assigned_idx      ON tasks (assigned_to, status) WHERE status != 'done';

ALTER PUBLICATION supabase_realtime ADD TABLE tasks;

-- ─── SOPs & Handbook ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sop_documents (
  id                       UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id                UUID    NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title                    TEXT    NOT NULL,
  category                 TEXT,
  content                  JSONB   NOT NULL DEFAULT '{}',
  version                  INT     NOT NULL DEFAULT 1,
  status                   TEXT    NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','active','archived')),
  requires_acknowledgement BOOLEAN NOT NULL DEFAULT FALSE,
  applicable_roles         TEXT[]  DEFAULT ARRAY['all'],
  created_by               UUID    REFERENCES auth.users(id),
  published_at             TIMESTAMPTZ,
  created_at               TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE sop_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sop_documents_tenant" ON sop_documents
  USING (tenant_id = (SELECT user_metadata->>'tenant_id' FROM auth.users WHERE id = auth.uid())::UUID);

CREATE TABLE IF NOT EXISTS sop_acknowledgements (
  sop_id          UUID NOT NULL REFERENCES sop_documents(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id)    ON DELETE CASCADE,
  acknowledged_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  PRIMARY KEY (sop_id, user_id)
);

ALTER TABLE sop_acknowledgements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sop_ack_own" ON sop_acknowledgements
  USING (user_id = auth.uid());

-- ─── Inventory ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS products (
  id              UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id       UUID    NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name            TEXT    NOT NULL,
  sku             TEXT,
  description     TEXT,
  category        TEXT,
  unit_price      NUMERIC(12,2),
  cost_price      NUMERIC(12,2),
  current_stock   INT     NOT NULL DEFAULT 0,
  reorder_level   INT     NOT NULL DEFAULT 0,
  reorder_quantity INT,
  unit            TEXT    NOT NULL DEFAULT 'unit',
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  image_url       TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE (tenant_id, sku)
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "products_tenant" ON products
  USING (tenant_id = (SELECT user_metadata->>'tenant_id' FROM auth.users WHERE id = auth.uid())::UUID);

CREATE TABLE IF NOT EXISTS inventory_transactions (
  id               UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id        UUID    NOT NULL REFERENCES tenants(id)  ON DELETE CASCADE,
  product_id       UUID    NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  transaction_type TEXT    NOT NULL
    CHECK (transaction_type IN ('receive','sell','adjust','return','damage','transfer')),
  quantity         INT     NOT NULL,
  unit_cost        NUMERIC(12,2),
  reference        TEXT,
  notes            TEXT,
  created_by       UUID    REFERENCES auth.users(id),
  created_at       TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inventory_tx_tenant" ON inventory_transactions
  USING (tenant_id = (SELECT user_metadata->>'tenant_id' FROM auth.users WHERE id = auth.uid())::UUID);

-- ─── Booking Engine ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS booking_services (
  id                    UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id             UUID    NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name                  TEXT    NOT NULL,
  description           TEXT,
  duration_minutes      INT     NOT NULL,
  price                 NUMERIC(12,2),
  buffer_minutes        INT     NOT NULL DEFAULT 0,
  max_bookings_per_slot INT     NOT NULL DEFAULT 1,
  staff_ids             UUID[]  DEFAULT ARRAY[]::UUID[],
  colour                TEXT    DEFAULT '#3B82F6',
  active                BOOLEAN NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE booking_services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "booking_services_tenant" ON booking_services
  USING (tenant_id = (SELECT user_metadata->>'tenant_id' FROM auth.users WHERE id = auth.uid())::UUID);

CREATE TABLE IF NOT EXISTS bookings (
  id               UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id        UUID    NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  service_id       UUID    REFERENCES booking_services(id) ON DELETE SET NULL,
  contact_id       UUID    REFERENCES contacts(id)         ON DELETE SET NULL,
  staff_id         UUID    REFERENCES staff(id)            ON DELETE SET NULL,
  start_at         TIMESTAMPTZ NOT NULL,
  end_at           TIMESTAMPTZ NOT NULL,
  status           TEXT    NOT NULL DEFAULT 'confirmed'
    CHECK (status IN ('pending','confirmed','cancelled','completed','no_show')),
  notes            TEXT,
  reminder_sent_at TIMESTAMPTZ,
  cancelled_reason TEXT,
  source           TEXT    NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual','widget','whatsapp','portal')),
  created_at       TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bookings_tenant" ON bookings
  USING (tenant_id = (SELECT user_metadata->>'tenant_id' FROM auth.users WHERE id = auth.uid())::UUID);

CREATE INDEX bookings_tenant_date_idx ON bookings (tenant_id, start_at);
ALTER PUBLICATION supabase_realtime ADD TABLE bookings;

-- ─── Contracts & eSignature ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS contracts (
  id             UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id      UUID    NOT NULL REFERENCES tenants(id)  ON DELETE CASCADE,
  contact_id     UUID    REFERENCES contacts(id)          ON DELETE SET NULL,
  title          TEXT    NOT NULL,
  contract_type  TEXT,
  content        JSONB   NOT NULL DEFAULT '{}',
  status         TEXT    NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','sent','partially_signed','signed','expired','cancelled')),
  value          NUMERIC(12,2),
  start_date     DATE,
  end_date       DATE,
  auto_renew     BOOLEAN NOT NULL DEFAULT FALSE,
  signed_at      TIMESTAMPTZ,
  created_by     UUID    REFERENCES auth.users(id),
  created_at     TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contracts_tenant" ON contracts
  USING (tenant_id = (SELECT user_metadata->>'tenant_id' FROM auth.users WHERE id = auth.uid())::UUID);

CREATE TABLE IF NOT EXISTS contract_signatures (
  id             UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_id    UUID    NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  signer_name    TEXT    NOT NULL,
  signer_email   TEXT,
  signer_role    TEXT,
  signed_at      TIMESTAMPTZ,
  signature_data TEXT,
  ip_address     INET,
  token          TEXT    UNIQUE DEFAULT gen_random_uuid()::TEXT NOT NULL,
  expires_at     TIMESTAMPTZ
);

-- ─── Supplier Directory ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS suppliers (
  id                     UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id              UUID    NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name                   TEXT    NOT NULL,
  category               TEXT,
  phone                  TEXT,
  email                  TEXT,
  website                TEXT,
  contact_person         TEXT,
  payment_terms          INT     NOT NULL DEFAULT 30,
  rating                 NUMERIC(3,2),
  is_community_verified  BOOLEAN NOT NULL DEFAULT FALSE,
  bbbbee_level           INT,
  women_owned            BOOLEAN NOT NULL DEFAULT FALSE,
  youth_owned            BOOLEAN NOT NULL DEFAULT FALSE,
  notes                  TEXT,
  created_at             TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "suppliers_tenant" ON suppliers
  USING (tenant_id = (SELECT user_metadata->>'tenant_id' FROM auth.users WHERE id = auth.uid())::UUID);
