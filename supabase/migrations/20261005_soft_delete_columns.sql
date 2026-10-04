-- 2026-10-05 — Phase 1(d): soft-delete columns (Rule #3: never hard-delete).
--
-- Live check on 2026-10-05: NO public table had a deleted_at column, so the
-- rule could not be followed anywhere and 10 routes hard-delete (contacts,
-- contacts/merge, creative-assets, documents, email-drafts, kb, sequences,
-- social/accounts, tasks; portal/generate rotates session tokens, which is
-- fine). Pair with lib/db/softDelete.ts.
--
-- Scope: tenant-owned business records a user can "delete". Deliberately
-- excluded: append-only logs (audit_log, messages, call_logs, payment_events,
-- ai_usage_logs, clock_events, inventory_transactions), derived snapshots,
-- config rows, join tables, global catalogues, and token stores
-- (portal_sessions, push_tokens).
--
-- Additive and nullable with no default: a metadata-only change, no rewrite,
-- no effect on existing queries until routes opt in with live().

ALTER TABLE public.announcements          ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.booking_services       ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.bookings               ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.branches               ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.broadcast_campaigns    ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.community_posts        ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.compliance_items       ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.contacts               ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.contracts              ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.creative_assets        ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.debtors                ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.disciplinary_records   ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.document_templates     ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.documents              ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.email_drafts           ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.expenses               ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.goals                  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.invoices               ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.kb_articles            ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.kb_categories          ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.leave_requests         ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.loyalty_programmes     ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.payroll_runs           ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.performance_reviews    ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.products               ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.professional_licenses  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.projects               ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.safety_incidents       ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.shifts                 ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.social_accounts        ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.sop_documents          ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.staff                  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.staff_documents        ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.stokvel_groups         ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.stokvel_members        ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.suppliers              ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.task_comments          ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.tasks                  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.whatsapp_sequences     ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.whatsapp_templates     ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- PostgREST caches the schema; reload so the new columns are queryable now.
NOTIFY pgrst, 'reload schema';
