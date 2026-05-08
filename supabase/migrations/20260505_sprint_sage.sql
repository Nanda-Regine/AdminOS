-- ---------------------------------------------------------------------------
-- Sprint 8: Sage Business Cloud OAuth connections
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS sage_connections (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  access_token   text        NOT NULL,
  refresh_token  text        NOT NULL,
  expires_at     timestamptz NOT NULL,
  company_id     text,
  company_name   text,
  connected_at   timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_sage_connections_tenant ON sage_connections(tenant_id);

ALTER TABLE sage_connections ENABLE ROW LEVEL SECURITY;

-- Only the owning tenant can read their own connection (token is sensitive)
CREATE POLICY "tenant_own_sage" ON sage_connections
  USING (
    tenant_id = (
      SELECT (raw_user_meta_data->>'tenant_id')::uuid
      FROM auth.users WHERE id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Done
-- ---------------------------------------------------------------------------
