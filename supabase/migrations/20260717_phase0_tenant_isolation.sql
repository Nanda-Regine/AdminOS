-- Phase 0 — Tenant isolation: move security claims out of user-writable metadata
-- 2026-07-17 · Mirembe Muse (Pty) Ltd
--
-- THE BUG
-- -------
-- tenant_id lived in auth.users.raw_user_meta_data, which the user owns and can
-- rewrite at will:
--
--     supabase.auth.updateUser({ data: { tenant_id: '<any-uuid>' } })
--
-- The anon key is public, so this is callable straight against Supabase's API —
-- the app never gets a say. current_tenant_id() then derived every RLS policy
-- from that spoofable value, so any signed-up user could read any tenant's
-- invoices, payroll, staff, disciplinary records and wellness scores
-- (POPIA s26 special personal information).
--
-- raw_app_meta_data is writable only by the service role. Same shape, same JWT,
-- but the user cannot touch it. This is the identical fix 20260612_admins_table.sql
-- applied to super-admin; tenant_id never got it.
--
-- ORDER MATTERS: the backfill (step 1) must land before the function swap
-- (step 2), or every existing user resolves a NULL tenant and RLS locks them out
-- of their own data. Both run in one transaction, so this file is safe to apply
-- as a unit. Re-running it is a no-op.
--
-- AFTER APPLYING: app_metadata changes only reach a session on token refresh.
-- Sessions issued before this migration keep the old JWT until it expires
-- (default 1h) and will see a NULL tenant until then. Force it if you must:
--     UPDATE auth.users SET updated_at = NOW();  -- does not invalidate sessions
-- or have affected users sign out and back in.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Backfill: copy the security claims into app_metadata
-- ---------------------------------------------------------------------------
-- Only the claims that grant access or gate billing move. Profile and
-- onboarding-UI keys (full_name, onboarding_step, onboarding_data, …) stay in
-- user_metadata — the user rewriting their own display name is not a breach.
--
-- Claims moved and why each is load-bearing:
--   tenant_id        — reads every table via RLS (the breach)
--   role             — super_admin gate in middleware.ts
--   suspended        — a suspended user could un-suspend themselves
--   plan             — gates.ts requirePlan() read it; free upgrade to any tier
--   trial_expired_at — middleware trial check read it; infinite free trial
--
-- COALESCE keeps an existing app_metadata value if one is already present, so
-- this never clobbers a good value with a stale user_metadata one on re-run.

UPDATE auth.users u
SET raw_app_meta_data =
      COALESCE(u.raw_app_meta_data, '{}'::jsonb)
      || jsonb_strip_nulls(jsonb_build_object(
           'tenant_id',        COALESCE(u.raw_app_meta_data ->> 'tenant_id',        u.raw_user_meta_data ->> 'tenant_id'),
           'role',             COALESCE(u.raw_app_meta_data ->> 'role',             u.raw_user_meta_data ->> 'role'),
           'suspended',        COALESCE(u.raw_app_meta_data -> 'suspended',         u.raw_user_meta_data -> 'suspended'),
           'plan',             COALESCE(u.raw_app_meta_data ->> 'plan',             u.raw_user_meta_data ->> 'plan'),
           'trial_expired_at', COALESCE(u.raw_app_meta_data ->> 'trial_expired_at', u.raw_user_meta_data ->> 'trial_expired_at')
         ))
WHERE u.raw_user_meta_data ?| array['tenant_id', 'role', 'suspended', 'plan', 'trial_expired_at']
   OR u.raw_app_meta_data  ?| array['tenant_id', 'role', 'suspended', 'plan', 'trial_expired_at'];

-- ---------------------------------------------------------------------------
-- 2. current_tenant_id() reads app_metadata ONLY
-- ---------------------------------------------------------------------------
-- Replaces master_schema.sql:90. The old body was:
--
--   SELECT COALESCE(
--     (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid,
--     (auth.jwt() ->> 'tenant_id')::uuid
--   )
--
-- Both sources are gone on purpose. Do NOT add a user_metadata fallback back in
-- "for compatibility" — a fallback is the vulnerability. If a user resolves NULL
-- here, the correct outcome is that they see nothing.
--
-- Every RLS policy calls this function and none of them change: fixing the
-- function fixes all ~40 policies at once. That is the whole argument of
-- WORKSPACE_ARCHITECTURE.md §2 in one statement.
--
-- The top-level (auth.jwt() ->> 'tenant_id') source is also dropped: nothing
-- issues that claim (it would need a custom access token hook), so it was dead
-- code that read as a second supported path.

CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT NULLIF(auth.jwt() -> 'app_metadata' ->> 'tenant_id', '')::uuid
$$;

COMMENT ON FUNCTION current_tenant_id() IS
  'Tenant for the current JWT, from app_metadata (service-role writable only). '
  'Never read tenant_id from user_metadata — the user can rewrite it. '
  'Returns NULL when absent, which denies access by design.';

-- ---------------------------------------------------------------------------
-- 3. current_user_role() — same rule, for policies that need role
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION current_user_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT auth.jwt() -> 'app_metadata' ->> 'role'
$$;

COMMENT ON FUNCTION current_user_role() IS
  'Role for the current JWT, from app_metadata (service-role writable only). '
  'Authoritative role for permission checks is the user_roles table; this is a '
  'coarse hint for RLS policies only.';

COMMIT;

-- ---------------------------------------------------------------------------
-- Verification — run after applying
-- ---------------------------------------------------------------------------
-- Every user with a tenant should now carry it in app_metadata. Expect 0 rows:
--
--   SELECT id, email
--   FROM auth.users
--   WHERE raw_user_meta_data ? 'tenant_id'
--     AND NOT (raw_app_meta_data ? 'tenant_id');
--
-- And the function should read app_metadata. Expect one row, no 'user_metadata':
--
--   SELECT prosrc FROM pg_proc WHERE proname = 'current_tenant_id';
