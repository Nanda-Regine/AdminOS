-- Phase 0 (cleanup) — remove the stale security claims from user_metadata
-- 2026-07-17 · Mirembe Muse (Pty) Ltd
--
-- ⚠️  DO NOT APPLY THIS WITH THE OTHER PHASE 0 MIGRATION.
--
-- Apply order:
--   1. 20260717_phase0_tenant_isolation.sql   (copies claims → app_metadata)
--   2. deploy the app                         (all code now reads app_metadata)
--   3. THIS FILE                              (deletes the old copies)
--
-- Step 1 copies rather than moves, on purpose: between the migration and the
-- deploy, the old code is still reading user_metadata, and deleting the values
-- underneath it would black out every live session. Once the deploy is out,
-- nothing reads these keys and the copies are pure hazard — a future dev finds
-- a plausible-looking tenant_id in user_metadata, reads it, and quietly
-- reintroduces the exact bug Phase 0 fixed. So they go.
--
-- This only strips keys that are known to exist in app_metadata, so it cannot
-- orphan a user whose backfill did not run. Re-running it is a no-op.

BEGIN;

UPDATE auth.users u
SET raw_user_meta_data = u.raw_user_meta_data - 'tenant_id'
WHERE u.raw_user_meta_data ? 'tenant_id'
  AND u.raw_app_meta_data ? 'tenant_id';

UPDATE auth.users u
SET raw_user_meta_data = u.raw_user_meta_data - 'role'
WHERE u.raw_user_meta_data ? 'role'
  AND u.raw_app_meta_data ? 'role';

UPDATE auth.users u
SET raw_user_meta_data = u.raw_user_meta_data - 'suspended'
WHERE u.raw_user_meta_data ? 'suspended'
  AND u.raw_app_meta_data ? 'suspended';

UPDATE auth.users u
SET raw_user_meta_data = u.raw_user_meta_data - 'plan'
WHERE u.raw_user_meta_data ? 'plan'
  AND u.raw_app_meta_data ? 'plan';

UPDATE auth.users u
SET raw_user_meta_data = u.raw_user_meta_data - 'trial_expired_at'
WHERE u.raw_user_meta_data ? 'trial_expired_at'
  AND u.raw_app_meta_data ? 'trial_expired_at';

-- staff_id was never written by any code path, only read (and spoofably so, in
-- the payslip route). Strip it unconditionally — there is no app_metadata copy
-- to guard against because nothing should ever have trusted it.
UPDATE auth.users u
SET raw_user_meta_data = u.raw_user_meta_data - 'staff_id'
WHERE u.raw_user_meta_data ? 'staff_id';

COMMIT;

-- Verification — expect 0 rows:
--
--   SELECT id, email
--   FROM auth.users
--   WHERE raw_user_meta_data ?| array['tenant_id','role','suspended','plan','trial_expired_at','staff_id'];
