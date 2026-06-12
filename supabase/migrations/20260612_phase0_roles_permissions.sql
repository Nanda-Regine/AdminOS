-- Phase 0.6 — Role & Permission System
-- Foundation for Employee OS: who can do what within a tenant

CREATE TABLE IF NOT EXISTS roles (
  id          UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id   UUID    NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        TEXT    NOT NULL,
  permissions TEXT[]  NOT NULL DEFAULT '{}',
  is_system   BOOLEAN DEFAULT FALSE,  -- system roles can't be deleted via UI
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE (tenant_id, name)
);

-- Each user has exactly one role per tenant (can have different roles across tenants)
CREATE TABLE IF NOT EXISTS user_roles (
  id          UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id   UUID    NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  role_id     UUID    NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  branch_id   UUID,   -- NULL = all branches; set to restrict to a specific branch
  assigned_by UUID    REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE (user_id, tenant_id)
);

CREATE INDEX user_roles_tenant_idx ON user_roles (tenant_id);
CREATE INDEX user_roles_user_idx   ON user_roles (user_id);

ALTER TABLE roles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "roles_tenant_isolation" ON roles
  USING (tenant_id = (auth.jwt() -> 'tenant_id')::uuid);

CREATE POLICY "user_roles_tenant_isolation" ON user_roles
  USING (tenant_id = (auth.jwt() -> 'tenant_id')::uuid);

-- Seed default system roles for every existing tenant
-- New tenants get these seeded in their onboarding Inngest function
INSERT INTO roles (tenant_id, name, permissions, is_system)
SELECT
  t.id,
  role_def.name,
  role_def.permissions,
  TRUE
FROM tenants t
CROSS JOIN (
  VALUES
    ('owner',       ARRAY[
      'manage_staff','view_financials','approve_leave','view_payroll',
      'manage_settings','manage_billing','view_analytics','send_broadcasts',
      'manage_invoices','manage_contacts','manage_documents','manage_inventory'
    ]),
    ('admin',       ARRAY[
      'manage_staff','view_financials','approve_leave','view_payroll',
      'manage_settings','view_analytics','send_broadcasts',
      'manage_invoices','manage_contacts','manage_documents','manage_inventory'
    ]),
    ('manager',     ARRAY[
      'view_financials','approve_leave','view_analytics',
      'manage_invoices','manage_contacts','manage_documents','manage_inventory'
    ]),
    ('staff',       ARRAY[
      'manage_contacts','manage_documents','view_own_data_only'
    ]),
    ('field_agent', ARRAY[
      'manage_contacts','view_own_data_only'
    ]),
    ('client',      ARRAY[
      'view_own_data_only'
    ])
) AS role_def(name, permissions)
ON CONFLICT (tenant_id, name) DO NOTHING;
