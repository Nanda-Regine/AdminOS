-- 2026-10-05 (Session 19) — what the AdminOS mobile app needs to be store-ready.
-- Additive only: new columns default to today's behaviour, new tables are
-- service-role only (RLS on, no client policies) and reached through
-- withRoute API routes. Safe to apply before or after the code deploys,
-- EXCEPT that the routes listed per section fail until it is applied.

-- ─── 1. Leave types (BCEA) ─────────────────────────────────────────────────
-- Every request was implicitly annual leave, so approving three days of sick
-- leave deducted three days of annual leave — the BCEA keeps them separate
-- (s20 annual, s22 sick, s27 family responsibility, s25 maternity, s25A
-- parental). Existing rows become 'annual', which is what they were treated as.
-- Used by: POST/GET /api/leave, lib/people/leave.ts decideLeave.
ALTER TABLE public.leave_requests
  ADD COLUMN IF NOT EXISTS leave_type text NOT NULL DEFAULT 'annual';
DO $$ BEGIN
  ALTER TABLE public.leave_requests ADD CONSTRAINT leave_requests_leave_type_check
    CHECK (leave_type IN ('annual','sick','family_responsibility','maternity','parental','study','unpaid'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS leave_requests_tenant_staff_idx
  ON public.leave_requests (tenant_id, staff_id, start_date) WHERE deleted_at IS NULL;

-- ─── 2. Staff invite codes ─────────────────────────────────────────────────
-- 0 of 12 live staff rows had a login (staff.user_id), so no employee could
-- use the staff app. Email can't carry invites (no working sender), so the
-- owner shares a one-time code over WhatsApp; the employee redeems it in the
-- app. Only the SHA-256 of the code is stored.
-- Used by: POST /api/staff/[id]/invite, POST /api/auth/invite/redeem.
CREATE TABLE IF NOT EXISTS public.staff_invites (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  staff_id    uuid        NOT NULL REFERENCES public.staff(id)   ON DELETE CASCADE,
  code_hash   text        NOT NULL UNIQUE,
  created_by  uuid        REFERENCES auth.users(id),
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz,
  used_by     uuid        REFERENCES auth.users(id),
  revoked_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS staff_invites_staff_idx ON public.staff_invites (tenant_id, staff_id);
ALTER TABLE public.staff_invites ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.staff_invites FROM anon, authenticated;

-- One login per staff row, one staff row per login in a tenant.
CREATE UNIQUE INDEX IF NOT EXISTS staff_tenant_user_uniq
  ON public.staff (tenant_id, user_id) WHERE user_id IS NOT NULL AND deleted_at IS NULL;

-- ─── 3. Account deletion requests (Google Play / AppGallery requirement) ───
-- Login is disabled at request time; personal identifiers on the auth user are
-- anonymised after the 30-day window by the accountDeletionPurge cron. Business
-- records (payslips, invoices, leave) are retained — BCEA s31 and Tax
-- Administration Act s29 require it — which the deletion page discloses.
-- Used by: POST/GET /api/account/delete, inngest accountDeletionPurge.
CREATE TABLE IF NOT EXISTS public.account_deletion_requests (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL,
  tenant_id    uuid        REFERENCES public.tenants(id) ON DELETE SET NULL,
  role         text,
  reason       text,
  source       text        NOT NULL DEFAULT 'app' CHECK (source IN ('app','web')),
  status       text        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','cancelled')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  purge_after  timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  completed_at timestamptz
);
CREATE INDEX IF NOT EXISTS account_deletion_due_idx
  ON public.account_deletion_requests (purge_after) WHERE status = 'pending';
CREATE UNIQUE INDEX IF NOT EXISTS account_deletion_one_open_per_user
  ON public.account_deletion_requests (user_id) WHERE status = 'pending';
ALTER TABLE public.account_deletion_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.account_deletion_requests FROM anon, authenticated;

-- ─── 4. Push tokens: soft revocation ───────────────────────────────────────
-- Expo reports DeviceNotRegistered for uninstalled apps; those tokens are
-- revoked (never hard-deleted, Rule #3) and skipped. Re-registering clears it.
-- Used by: lib/notifications/push.ts, POST /api/push/register.
ALTER TABLE public.push_tokens ADD COLUMN IF NOT EXISTS revoked_at timestamptz;
ALTER TABLE public.push_tokens ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS push_tokens_tenant_user_idx
  ON public.push_tokens (tenant_id, user_id) WHERE revoked_at IS NULL;

-- ─── 5. Notifications: tenant-level alerts ─────────────────────────────────
-- lib/notifications/notify.ts writes owner alerts with user_id NULL (tenant
-- level). The original mobile migration declared user_id NOT NULL; make the
-- schema match how the app has written the table since August.
ALTER TABLE public.notifications ALTER COLUMN user_id DROP NOT NULL;
CREATE INDEX IF NOT EXISTS notifications_tenant_created_idx
  ON public.notifications (tenant_id, created_at DESC);

-- ─── 6. Private bucket for expense receipts ────────────────────────────────
-- Receipts show names, card digits and addresses: never public. Served only
-- through GET /api/expenses/[id]/receipt as a short-lived signed URL after the
-- same own-or-finance check as the claim itself.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('expense-receipts', 'expense-receipts', false, 4194304,
        ARRAY['image/jpeg','image/png','image/webp','application/pdf'])
ON CONFLICT (id) DO NOTHING;
