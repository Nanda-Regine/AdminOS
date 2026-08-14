-- Phase 0 follow-up — six migration files missed by the July 17 fix
-- 2026-08-14 · Mirembe Muse (Pty) Ltd
--
-- THE GAP
-- -------
-- 20260717_phase0_tenant_isolation.sql fixed current_tenant_id() to read
-- tenant_id from app_metadata (service-role only) instead of user_metadata
-- (user-writable via supabase.auth.updateUser()), and its own comment claims
-- "every RLS policy calls this function... fixing the function fixes all
-- ~40 policies at once."
--
-- That wasn't true for six migration files, all dated 20260612 — before the
-- fix — which hardcode the vulnerable expression directly instead of calling
-- current_tenant_id():
--
--   20260612_phase5_financial.sql   (payroll, cashflow, NPS, loyalty, profit-first)
--   20260612_phase6_operations.sql  (projects, tasks, SOPs, inventory, bookings,
--                                    contracts, suppliers)
--   20260612_phase7_ubuntu.sql      (stokvel, mentorship, community, formalization)
--   20260612_phase8_compliance.sql  (compliance calendar, licenses, EE data, safety)
--   20260612_phase9_11_advanced.sql (valuation, social inbox, branches, KB)
--   20260612_phase11_billing.sql    (plan changes, add-ons, special pricing)
--
-- Any signed-up user could still call
--   supabase.auth.updateUser({ data: { tenant_id: '<any-uuid>' } })
-- and read/write another tenant's data on these 33 policies — including
-- payroll, contracts, and compliance/HR records. Migrations written after
-- the July 17 fix (e.g. 20260721_task_comments.sql) already call
-- current_tenant_id() correctly; this file brings the six earlier ones in
-- line with that pattern. Re-running it is a no-op.

BEGIN;

-- ─── Phase 6 — Operations ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "projects_tenant" ON projects;
CREATE POLICY "projects_tenant" ON projects
  USING (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS "tasks_tenant" ON tasks;
CREATE POLICY "tasks_tenant" ON tasks
  USING (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS "sop_documents_tenant" ON sop_documents;
CREATE POLICY "sop_documents_tenant" ON sop_documents
  USING (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS "products_tenant" ON products;
CREATE POLICY "products_tenant" ON products
  USING (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS "inventory_tx_tenant" ON inventory_transactions;
CREATE POLICY "inventory_tx_tenant" ON inventory_transactions
  USING (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS "booking_services_tenant" ON booking_services;
CREATE POLICY "booking_services_tenant" ON booking_services
  USING (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS "bookings_tenant" ON bookings;
CREATE POLICY "bookings_tenant" ON bookings
  USING (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS "contracts_tenant" ON contracts;
CREATE POLICY "contracts_tenant" ON contracts
  USING (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS "suppliers_tenant" ON suppliers;
CREATE POLICY "suppliers_tenant" ON suppliers
  USING (tenant_id = current_tenant_id());

-- ─── Phase 7 — Ubuntu & Community ──────────────────────────────────────────
DROP POLICY IF EXISTS "stokvel_groups_tenant" ON stokvel_groups;
CREATE POLICY "stokvel_groups_tenant" ON stokvel_groups
  USING (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS "stokvel_members_tenant" ON stokvel_members;
CREATE POLICY "stokvel_members_tenant" ON stokvel_members
  USING (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS "stokvel_contributions_group" ON stokvel_contributions;
CREATE POLICY "stokvel_contributions_group" ON stokvel_contributions
  USING (group_id IN (
    SELECT id FROM stokvel_groups WHERE tenant_id = current_tenant_id()
  ));

DROP POLICY IF EXISTS "mentor_connections_participant" ON mentor_connections;
CREATE POLICY "mentor_connections_participant" ON mentor_connections
  USING (
    mentor_tenant_id = current_tenant_id()
    OR mentee_tenant_id = current_tenant_id()
  );

-- community_posts_read (status = 'active') is untouched — it never carried
-- the tenant_id claim to begin with.
DROP POLICY IF EXISTS "community_posts_own" ON community_posts;
CREATE POLICY "community_posts_own" ON community_posts FOR INSERT
  WITH CHECK (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS "formalization_own" ON formalization_progress;
CREATE POLICY "formalization_own" ON formalization_progress
  USING (tenant_id = current_tenant_id());

-- ─── Phase 8 — Compliance ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "compliance_items_tenant" ON compliance_items;
CREATE POLICY "compliance_items_tenant" ON compliance_items
  USING (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS "professional_licenses_tenant" ON professional_licenses;
CREATE POLICY "professional_licenses_tenant" ON professional_licenses
  USING (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS "ee_data_tenant" ON employment_equity_data;
CREATE POLICY "ee_data_tenant" ON employment_equity_data
  USING (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS "safety_incidents_tenant" ON safety_incidents;
CREATE POLICY "safety_incidents_tenant" ON safety_incidents
  USING (tenant_id = current_tenant_id());

-- ─── Phase 9–11 — Advanced ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "valuation_snapshots_tenant" ON valuation_snapshots;
CREATE POLICY "valuation_snapshots_tenant" ON valuation_snapshots
  USING (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS "social_accounts_tenant" ON social_accounts;
CREATE POLICY "social_accounts_tenant" ON social_accounts
  USING (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS "social_messages_tenant" ON social_messages;
CREATE POLICY "social_messages_tenant" ON social_messages
  USING (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS "branches_tenant" ON branches;
CREATE POLICY "branches_tenant" ON branches
  USING (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS "kb_categories_tenant" ON kb_categories;
CREATE POLICY "kb_categories_tenant" ON kb_categories
  USING (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS "kb_articles_tenant" ON kb_articles;
CREATE POLICY "kb_articles_tenant" ON kb_articles
  USING (tenant_id = current_tenant_id());

-- ─── Phase 5 — Financial ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "payroll_runs_tenant" ON payroll_runs;
CREATE POLICY "payroll_runs_tenant" ON payroll_runs
  USING (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS "payslips_tenant" ON payslips;
CREATE POLICY "payslips_tenant" ON payslips
  USING (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS "cashflow_forecasts_tenant" ON cashflow_forecasts;
CREATE POLICY "cashflow_forecasts_tenant" ON cashflow_forecasts
  USING (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS "nps_surveys_tenant" ON nps_surveys;
CREATE POLICY "nps_surveys_tenant" ON nps_surveys
  USING (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS "loyalty_programmes_tenant" ON loyalty_programmes;
CREATE POLICY "loyalty_programmes_tenant" ON loyalty_programmes
  USING (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS "loyalty_points_tenant" ON loyalty_points;
CREATE POLICY "loyalty_points_tenant" ON loyalty_points
  USING (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS "profit_first_config_tenant" ON profit_first_config;
CREATE POLICY "profit_first_config_tenant" ON profit_first_config
  USING (tenant_id = current_tenant_id());

-- ─── Phase 11 — Billing ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "plan_changes_tenant" ON plan_changes;
CREATE POLICY "plan_changes_tenant" ON plan_changes
  USING (tenant_id = current_tenant_id());

-- addon_subscriptions: table does not exist in production yet (confirmed via
-- information_schema on 2026-08-14) even though 20260612_phase11_billing.sql
-- defines it — that migration was only partially applied. Nothing to fix here
-- until the table exists; when it's created, seed its policy with
-- current_tenant_id() from the start rather than the old inline pattern.

DROP POLICY IF EXISTS "special_pricing_tenant" ON special_pricing_applications;
CREATE POLICY "special_pricing_tenant" ON special_pricing_applications
  USING (tenant_id = current_tenant_id());

COMMIT;

-- ---------------------------------------------------------------------------
-- Verification — run after applying. Expect 0 rows (no policy on any table
-- still reading the spoofable user_metadata claim):
--
--   SELECT schemaname, tablename, policyname, qual
--   FROM pg_policies
--   WHERE (qual LIKE '%user_metadata%' OR with_check LIKE '%user_metadata%')
--     AND schemaname = 'public';
-- ---------------------------------------------------------------------------
