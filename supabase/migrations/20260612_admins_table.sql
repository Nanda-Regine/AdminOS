-- Super admins table.
-- Rows here are the authoritative source of super-admin privilege.
-- Only the service role (supabaseAdmin) can write to this table.
-- Regular authenticated users have NO access — RLS is enabled but no
-- user-facing policies exist, so client-SDK calls always return empty.
-- This eliminates the JWT user_metadata privilege-escalation vector:
-- a user calling supabase.auth.updateUser({ data: { role: 'super_admin' } })
-- writes to user_metadata (which they own), but never gets a row here.

CREATE TABLE IF NOT EXISTS admins (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_by UUID        REFERENCES auth.users(id),
  UNIQUE(user_id)
);

ALTER TABLE admins ENABLE ROW LEVEL SECURITY;

-- Audit log: super-admin grant/revoke events
COMMENT ON TABLE admins IS
  'Authoritative super-admin roster. Only writable via service role. '
  'Verified on every admin API call — JWT metadata alone is not trusted.';
