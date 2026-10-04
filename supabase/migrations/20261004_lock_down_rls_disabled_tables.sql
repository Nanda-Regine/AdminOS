-- 2026-10-04 — Close anon/authenticated access to 13 RLS-disabled tables and
-- 2 SECURITY DEFINER views (Supabase advisor: rls_disabled_in_public ×13 ERROR,
-- security_definer_view ×2 ERROR).
--
-- Before this, anyone holding the public anon key (shipped in every browser
-- bundle) could, with no login: read/edit/delete every tenant's notifications
-- and contract_signatures (signer names + emails), rewrite plan_catalogue /
-- addon_catalogue (live pricing), and read every tenant's overdue invoices and
-- staff wellness data through the definer views, which bypass invoices/staff RLS.
--
-- Safe for the web app: every web/Inngest read and write of these objects goes
-- through supabaseAdmin (service role), which bypasses RLS. Verified by grep of
-- app/, components/, lib/, inngest/ on 2026-10-04. The only user-session reads
-- are in the (unshipped) Expo app: notifications (own rows) and academy_lessons
-- — both kept working by the two policies below.

-- 1. Enable RLS. With no policy, only the service role can touch the table.
ALTER TABLE public.notifications              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_signatures        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.triggered_lessons          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_in_action_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievements               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_modules            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_lessons            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.framework_library          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contextual_triggers        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.impact_snapshots           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coaching_cards             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_catalogue             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.addon_catalogue            ENABLE ROW LEVEL SECURITY;

-- 2. Belt and braces: anon never writes any of these.
REVOKE INSERT, UPDATE, DELETE ON
  public.notifications, public.contract_signatures, public.triggered_lessons,
  public.book_in_action_completions, public.achievements, public.academy_modules,
  public.academy_lessons, public.framework_library, public.contextual_triggers,
  public.impact_snapshots, public.coaching_cards, public.plan_catalogue,
  public.addon_catalogue
FROM anon;

-- 3. Minimal user-session access the mobile app needs.
DROP POLICY IF EXISTS notifications_own_select ON public.notifications;
CREATE POLICY notifications_own_select ON public.notifications
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) AND tenant_id = (SELECT current_tenant_id()));

DROP POLICY IF EXISTS notifications_own_mark_read ON public.notifications;
CREATE POLICY notifications_own_mark_read ON public.notifications
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()) AND tenant_id = (SELECT current_tenant_id()))
  WITH CHECK (user_id = (SELECT auth.uid()) AND tenant_id = (SELECT current_tenant_id()));

-- Global course content, not tenant data.
DROP POLICY IF EXISTS academy_lessons_read ON public.academy_lessons;
CREATE POLICY academy_lessons_read ON public.academy_lessons
  FOR SELECT TO authenticated
  USING (true);

-- expo-app training.tsx embeds academy_modules through academy_lessons.
DROP POLICY IF EXISTS academy_modules_read ON public.academy_modules;
CREATE POLICY academy_modules_read ON public.academy_modules
  FOR SELECT TO authenticated
  USING (true);

-- 4. Definer views ran as their owner and skipped RLS on invoices/staff.
-- Make them respect the caller's RLS, and take them off the client roles
-- entirely (only lib/intelligence/healthScore.ts reads wellness_summary, via
-- the service role; nothing reads overdue_invoices).
ALTER VIEW public.overdue_invoices SET (security_invoker = true);
ALTER VIEW public.wellness_summary SET (security_invoker = true);
REVOKE ALL ON public.overdue_invoices, public.wellness_summary FROM anon, authenticated;
