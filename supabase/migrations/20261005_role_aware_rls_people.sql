-- 2026-10-05 (Session 19, People/HR sweep) — role-aware RLS for people + money
-- tables, two spoofable policies, and tenant self-upgrade.
--
-- Found live (Management API, 2026-10-05):
--
-- 1. RLS on every HR table was tenant-only: `USING (tenant_id = current_tenant_id())`.
--    Phase 0 follow-up 3 revoked client WRITES on staff/payslips/payroll_runs/
--    disciplinary/performance, but left SELECT tenant-wide. Any login in a
--    tenant — a cleaner on the staff app — could, with the public anon key and
--    their own JWT, read every colleague's salary, ID number and bank account
--    (staff), every payslip, every disciplinary record and performance review.
--    withRoute's role matrix only guards the API; PostgREST is a second door.
--
-- 2. Tables still fully writable by any member (authenticated had
--    INSERT/UPDATE/DELETE + tenant-only policy):
--      leave_requests   — approve your own leave (`update … set status='approved'`)
--      expenses         — approve / mark paid your own claim
--      invoices         — mark any invoice paid, change amounts, delete
--      clock_events     — rewrite or delete attendance (yours or anyone's)
--      shifts, announcements, sop_documents, safety_incidents,
--      staff_documents, employment_equity_data — rewrite HR records
--      tenants          — `update tenants set plan='scale'`: billing bypass,
--                         readable by planGates.ts. Any member, incl. owners.
--
-- 3. Two policies trust auth.users.raw_user_meta_data, which the user writes
--    themselves (supabase.auth.updateUser({ data: … })). The Aug 14 sweep
--    searched for "user_metadata" and missed the "raw_user_meta_data" spelling:
--      sage_connections   — set your tenant_id → read another tenant's Sage
--                           OAuth access + refresh tokens
--      payment_events     — set role=super_admin → read/write every tenant's
--                           billing events
--    No application code reads either table with a user session (payment_events
--    is written by billing webhooks via the service role; sage_connections has
--    no code references). Dropping the policies leaves them service-role only.
--
-- Safe for the web app: every server read and write of these tables goes
-- through supabaseAdmin (service role bypasses RLS and grants) — verified by
-- grep 2026-10-05. The only ctx.db (session-client) user is creative-assets.
-- The unshipped Expo app keeps exactly what a staff app needs: its own staff
-- row, own clock events / leave / expenses / payslips / documents, and the
-- tenant's announcements, handbook and shifts. (Expo screens have separate
-- column drift; see BUILD_JOURNEY Session 19.)

-- ─── Helpers ────────────────────────────────────────────────────────────────

-- Does the caller hold `perm` in their current tenant? Same source of truth as
-- lib/auth/context.ts (user_roles → roles.permissions), never a JWT claim.
CREATE OR REPLACE FUNCTION public.has_permission(perm text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
      AND ur.tenant_id = public.current_tenant_id()
      AND perm = ANY (r.permissions)
  )
$$;

-- Is this staff row the caller's own (staff.user_id link, same tenant)?
-- SECURITY DEFINER so staff's own RLS doesn't recurse into this check.
CREATE OR REPLACE FUNCTION public.is_own_staff(p_staff_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff s
    WHERE s.id = p_staff_id
      AND s.user_id = auth.uid()
      AND s.tenant_id = public.current_tenant_id()
      AND s.deleted_at IS NULL
  )
$$;

REVOKE ALL ON FUNCTION public.has_permission(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_own_staff(uuid)   FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_permission(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_own_staff(uuid)   TO authenticated;

-- ─── 3. Spoofable policies → service role only ─────────────────────────────

DROP POLICY IF EXISTS tenant_own_sage ON public.sage_connections;
DROP POLICY IF EXISTS super_admin_payment_events ON public.payment_events;
REVOKE ALL ON public.sage_connections, public.payment_events FROM anon, authenticated;

-- ─── 2a. tenants: read your own, never write ───────────────────────────────

DROP POLICY IF EXISTS tenant_update_own ON public.tenants;
DROP POLICY IF EXISTS tenants_update    ON public.tenants;
REVOKE INSERT, UPDATE, DELETE ON public.tenants FROM anon, authenticated;

-- ─── 1 + 2b. People / money tables ─────────────────────────────────────────
-- Pattern: drop the tenant-only policy, add a role-aware SELECT, and add an
-- INSERT policy only where a staff member legitimately files their own row.
-- Updates/deletes go through the API (service role) — revoked from clients.

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'staff','payslips','payroll_runs','disciplinary_records','performance_reviews',
    'staff_documents','clock_events','leave_requests','employment_equity_data',
    'safety_incidents','shifts','announcements','sop_documents','expenses','invoices'
  ] LOOP
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE ON public.%I FROM anon, authenticated', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
  END LOOP;
END $$;

-- staff — HR/payroll see everyone; a member sees only their own row.
DROP POLICY IF EXISTS staff_select ON public.staff;
DROP POLICY IF EXISTS staff_insert ON public.staff;
DROP POLICY IF EXISTS staff_update ON public.staff;
DROP POLICY IF EXISTS staff_delete ON public.staff;
CREATE POLICY staff_select ON public.staff FOR SELECT TO authenticated
  USING (tenant_id = (SELECT public.current_tenant_id()) AND (
    (SELECT public.has_permission('manage_staff'))
    OR (SELECT public.has_permission('view_payroll'))
    OR user_id = (SELECT auth.uid())
  ));

-- payslips / payroll_runs — payroll sees all; a member sees their own payslips
-- once the run is paid (not while payroll is still reviewing figures).
DROP POLICY IF EXISTS payslips_tenant ON public.payslips;
CREATE POLICY payslips_select ON public.payslips FOR SELECT TO authenticated
  USING (tenant_id = (SELECT public.current_tenant_id()) AND (
    (SELECT public.has_permission('view_payroll'))
    OR (public.is_own_staff(staff_id) AND deleted_at IS NULL AND EXISTS (
      SELECT 1 FROM public.payroll_runs r
      WHERE r.id = payroll_run_id AND r.tenant_id = payslips.tenant_id AND r.status = 'paid'
    ))
  ));

DROP POLICY IF EXISTS payroll_runs_tenant ON public.payroll_runs;
CREATE POLICY payroll_runs_select ON public.payroll_runs FOR SELECT TO authenticated
  USING (tenant_id = (SELECT public.current_tenant_id()) AND (SELECT public.has_permission('view_payroll')));

-- HR records — HR sees all; an employee may see records about themselves.
DROP POLICY IF EXISTS disciplinary_tenant ON public.disciplinary_records;
CREATE POLICY disciplinary_select ON public.disciplinary_records FOR SELECT TO authenticated
  USING (tenant_id = (SELECT public.current_tenant_id()) AND (
    (SELECT public.has_permission('manage_staff')) OR public.is_own_staff(staff_id)
  ));

DROP POLICY IF EXISTS performance_reviews_tenant ON public.performance_reviews;
CREATE POLICY performance_reviews_select ON public.performance_reviews FOR SELECT TO authenticated
  USING (tenant_id = (SELECT public.current_tenant_id()) AND (
    (SELECT public.has_permission('manage_staff')) OR public.is_own_staff(staff_id)
  ));

DROP POLICY IF EXISTS staff_documents_tenant ON public.staff_documents;
CREATE POLICY staff_documents_select ON public.staff_documents FOR SELECT TO authenticated
  USING (tenant_id = (SELECT public.current_tenant_id()) AND (
    (SELECT public.has_permission('manage_staff')) OR public.is_own_staff(staff_id)
  ));

DROP POLICY IF EXISTS ee_data_tenant ON public.employment_equity_data;
CREATE POLICY ee_data_select ON public.employment_equity_data FOR SELECT TO authenticated
  USING (tenant_id = (SELECT public.current_tenant_id()) AND (SELECT public.has_permission('manage_staff')));

-- Safety — anyone reports (via API); HR reads all, reporters read their own.
DROP POLICY IF EXISTS safety_incidents_tenant ON public.safety_incidents;
CREATE POLICY safety_incidents_select ON public.safety_incidents FOR SELECT TO authenticated
  USING (tenant_id = (SELECT public.current_tenant_id()) AND (
    (SELECT public.has_permission('manage_staff')) OR created_by = (SELECT auth.uid())
  ));

-- Attendance — HR reads all; a member reads and files only their own.
DROP POLICY IF EXISTS clock_events_tenant ON public.clock_events;
CREATE POLICY clock_events_select ON public.clock_events FOR SELECT TO authenticated
  USING (tenant_id = (SELECT public.current_tenant_id()) AND (
    (SELECT public.has_permission('manage_staff')) OR public.is_own_staff(staff_id)
  ));
CREATE POLICY clock_events_insert_own ON public.clock_events FOR INSERT TO authenticated
  WITH CHECK (tenant_id = (SELECT public.current_tenant_id()) AND public.is_own_staff(staff_id));
GRANT INSERT ON public.clock_events TO authenticated;

-- Leave — approvers read all; a member reads and requests only their own,
-- and a request can only be born pending.
DROP POLICY IF EXISTS leave_requests_select ON public.leave_requests;
DROP POLICY IF EXISTS leave_requests_insert ON public.leave_requests;
DROP POLICY IF EXISTS leave_requests_update ON public.leave_requests;
DROP POLICY IF EXISTS leave_requests_delete ON public.leave_requests;
CREATE POLICY leave_requests_select ON public.leave_requests FOR SELECT TO authenticated
  USING (tenant_id = (SELECT public.current_tenant_id()) AND (
    (SELECT public.has_permission('approve_leave'))
    OR (SELECT public.has_permission('manage_staff'))
    OR public.is_own_staff(staff_id)
  ));
CREATE POLICY leave_requests_insert_own ON public.leave_requests FOR INSERT TO authenticated
  WITH CHECK (tenant_id = (SELECT public.current_tenant_id())
    AND public.is_own_staff(staff_id)
    AND status = 'pending' AND approved_by IS NULL AND approved_at IS NULL);
GRANT INSERT ON public.leave_requests TO authenticated;

-- Expenses — finance reads all; a member reads and submits only their own,
-- born pending (approval/payment only through the API).
DROP POLICY IF EXISTS expenses_tenant ON public.expenses;
CREATE POLICY expenses_select ON public.expenses FOR SELECT TO authenticated
  USING (tenant_id = (SELECT public.current_tenant_id()) AND (
    (SELECT public.has_permission('view_financials')) OR public.is_own_staff(staff_id)
  ));
CREATE POLICY expenses_insert_own ON public.expenses FOR INSERT TO authenticated
  WITH CHECK (tenant_id = (SELECT public.current_tenant_id())
    AND public.is_own_staff(staff_id)
    AND status = 'pending' AND approved_by IS NULL AND approved_at IS NULL AND paid_at IS NULL);
GRANT INSERT ON public.expenses TO authenticated;

-- Invoices — readable by those who manage invoices or see financials; all
-- writes through /api/invoices (numbering, VAT rules, stock, audit).
DROP POLICY IF EXISTS invoices_select ON public.invoices;
DROP POLICY IF EXISTS invoices_insert ON public.invoices;
DROP POLICY IF EXISTS invoices_update ON public.invoices;
DROP POLICY IF EXISTS invoices_delete ON public.invoices;
CREATE POLICY invoices_select ON public.invoices FOR SELECT TO authenticated
  USING (tenant_id = (SELECT public.current_tenant_id()) AND (
    (SELECT public.has_permission('manage_invoices')) OR (SELECT public.has_permission('view_financials'))
  ));

-- Tenant-wide reading material — every member reads, nobody writes directly.
DROP POLICY IF EXISTS shifts_tenant ON public.shifts;
CREATE POLICY shifts_select ON public.shifts FOR SELECT TO authenticated
  USING (tenant_id = (SELECT public.current_tenant_id()));

DROP POLICY IF EXISTS announcements_tenant ON public.announcements;
CREATE POLICY announcements_select ON public.announcements FOR SELECT TO authenticated
  USING (tenant_id = (SELECT public.current_tenant_id()) AND deleted_at IS NULL);

DROP POLICY IF EXISTS sop_documents_tenant ON public.sop_documents;
CREATE POLICY sop_documents_select ON public.sop_documents FOR SELECT TO authenticated
  USING (tenant_id = (SELECT public.current_tenant_id()) AND deleted_at IS NULL);

-- sop_acknowledgements / announcement_reads stay `user_id = auth.uid()` (own
-- rows only), but the sop/announcement id was unchecked: a user could write a
-- receipt against another tenant's id. Harmless data-wise, tightened anyway.
DROP POLICY IF EXISTS sop_ack_own ON public.sop_acknowledgements;
CREATE POLICY sop_ack_own ON public.sop_acknowledgements FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()) AND EXISTS (
    SELECT 1 FROM public.sop_documents d
    WHERE d.id = sop_id AND d.tenant_id = (SELECT public.current_tenant_id())
  ));
