-- Reconcile DB with code for the last schema gaps found in the Session 14
-- schema-drift sweep (scripts/audit_selects.mjs). All additive / low-risk.

-- 1. Staff HR documents. The /api/staff/[id]/documents route was reading a
--    non-existent set of columns on `documents` (staff_id/title/file_url/…);
--    those belong in their own table. Tenant-scoped like every other table.
CREATE TABLE IF NOT EXISTS public.staff_documents (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  staff_id   uuid NOT NULL REFERENCES public.staff(id)   ON DELETE CASCADE,
  title      text NOT NULL,
  file_url   text NOT NULL,
  file_type  text,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_documents_tenant_staff
  ON public.staff_documents (tenant_id, staff_id);

ALTER TABLE public.staff_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS staff_documents_tenant ON public.staff_documents;
CREATE POLICY staff_documents_tenant ON public.staff_documents
  FOR ALL USING (tenant_id = public.current_tenant_id());

-- 2. Employment-Equity demographics on staff. The /api/ee/report route builds
--    the statutory EEA2 return (occupational level × race × gender), which the
--    Employment Equity Act requires — but staff had none of these fields.
--    Nullable so existing rows are unaffected; capture is optional/consented.
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS gender    text;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS race      text;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS job_level text;

-- 3. Enable PostgREST aggregate functions (cost_usd.sum() etc.) used by the
--    super-admin /api/admin/ai-costs dashboard. Read-only and still RLS-scoped.
ALTER ROLE authenticator SET pgrst.db_aggregates_enabled TO 'true';
NOTIFY pgrst, 'reload config';
