-- Phase 0 follow-up 3 — close in-tenant privilege escalation.
--
-- Phase 0 and its two August follow-ups fixed WHICH TENANT a caller can reach
-- (current_tenant_id() from app_metadata, never user_metadata — verified: 0
-- policies still read user_metadata). They never constrained WHAT a caller may
-- do inside their own tenant.
--
-- Every sensitive table carries one policy of the shape
--   FOR ALL USING (tenant_id = current_tenant_id())   -- with_check NULL
-- and Supabase grants ALL on public tables to `authenticated` by default. On a
-- FOR ALL policy a NULL with_check falls back to the USING clause, so the
-- tenant match is the only gate on writes. Any staff user, with the public anon
-- key from their own browser, could run:
--
--   supabase.from('user_roles').update({ role_id: <owner> }).eq('user_id', me)
--
-- and become owner — defeating checkPermission entirely. Same shape let them
-- read every payslip in the company and set subscriptions.plan themselves.
--
-- Fix: revoke write grants from `authenticated` on the privilege- and
-- money-bearing tables. Safe because 100% of application writes go through
-- lib/supabase/admin.ts (service role), which bypasses both RLS and grants;
-- no client component writes to these tables. SELECT is left intact so the
-- existing tenant-isolation policies keep governing reads.

do $$
declare
  t text;
  sensitive text[] := array[
    'roles',                  -- permissions array — rewrite = self-grant
    'user_roles',             -- role assignment — the escalation vector
    'payslips',               -- salaries
    'payroll_runs',
    'staff',                  -- salary column
    'subscriptions',          -- plan/tier — self-upgrade
    'disciplinary_records',
    'performance_reviews'
  ];
begin
  foreach t in array sensitive loop
    if exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = t
    ) then
      execute format('revoke insert, update, delete on public.%I from authenticated', t);
      execute format('revoke insert, update, delete on public.%I from anon', t);
      raise notice 'revoked client writes on %', t;
    else
      raise notice 'skipped % (table not present)', t;
    end if;
  end loop;
end $$;
