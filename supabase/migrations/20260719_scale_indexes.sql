-- Scale indexes — every tenant-scoped table needs a tenant_id-leading index.
--
-- RLS filters every read by `tenant_id = current_tenant_id()`, so without a
-- tenant_id index each query is a full-table scan filtered afterwards. Fine at
-- one tenant; at thousands it's O(all rows) on every dashboard load. An audit
-- found 36 base tables missing one. Added now while the DB is empty (instant,
-- free). Core money/ops/people tables were already covered.
--
-- Pattern: (tenant_id, created_at DESC) where the table has created_at (list
-- pages order newest-first), else (tenant_id). notifications gets a purpose-built
-- composite for the notification spine's dedupe + bell queries.

-- ── (tenant_id, created_at DESC) — list surfaces ordered newest-first ─────────
CREATE INDEX IF NOT EXISTS idx_academy_progress_tenant       ON public.academy_progress       (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_announcements_tenant          ON public.announcements          (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_board_packs_tenant            ON public.board_packs            (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_booking_services_tenant       ON public.booking_services       (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_branches_tenant               ON public.branches               (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clock_events_tenant           ON public.clock_events           (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_posts_tenant        ON public.community_posts        (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contracts_tenant              ON public.contracts              (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_disciplinary_records_tenant   ON public.disciplinary_records   (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_document_templates_tenant     ON public.document_templates     (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_goals_tenant                  ON public.goals                  (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_tenant ON public.inventory_transactions (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kb_articles_tenant            ON public.kb_articles            (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kb_categories_tenant          ON public.kb_categories          (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leave_requests_tenant         ON public.leave_requests         (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_loyalty_points_tenant         ON public.loyalty_points         (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_loyalty_programmes_tenant     ON public.loyalty_programmes     (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payslips_tenant               ON public.payslips               (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_performance_reviews_tenant    ON public.performance_reviews    (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_plan_changes_tenant           ON public.plan_changes           (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_projects_tenant               ON public.projects               (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_push_tokens_tenant            ON public.push_tokens            (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_safety_incidents_tenant       ON public.safety_incidents       (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sequence_enrollments_tenant   ON public.sequence_enrollments   (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_social_messages_tenant        ON public.social_messages        (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sop_documents_tenant          ON public.sop_documents          (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stokvel_groups_tenant         ON public.stokvel_groups         (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_suppliers_tenant              ON public.suppliers              (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_sequences_tenant     ON public.whatsapp_sequences     (tenant_id, created_at DESC);

-- ── (tenant_id) — tables without a created_at column ─────────────────────────
CREATE INDEX IF NOT EXISTS idx_academy_certificates_tenant       ON public.academy_certificates       (tenant_id);
CREATE INDEX IF NOT EXISTS idx_book_in_action_completions_tenant ON public.book_in_action_completions (tenant_id);
CREATE INDEX IF NOT EXISTS idx_learning_streaks_tenant           ON public.learning_streaks           (tenant_id);
CREATE INDEX IF NOT EXISTS idx_stokvel_members_tenant            ON public.stokvel_members            (tenant_id);
CREATE INDEX IF NOT EXISTS idx_triggered_lessons_tenant          ON public.triggered_lessons          (tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_tenant          ON public.user_achievements          (tenant_id);

-- ── notifications — the spine's hot table (dedupe + unread bell) ─────────────
-- notify() dedupe: WHERE tenant_id=? AND read=false AND created_at>=? ; the bell:
-- WHERE tenant_id=? [AND user_id] AND read=? ORDER BY created_at DESC.
CREATE INDEX IF NOT EXISTS idx_notifications_tenant_read ON public.notifications (tenant_id, read, created_at DESC);

-- ── Cleanup: invoices had two identical (tenant_id, status) indexes ──────────
DROP INDEX IF EXISTS public.idx_invoices_status; -- keep idx_invoices_tenant_status
