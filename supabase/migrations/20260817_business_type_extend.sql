-- Extends the `business_type` enum to cover the industries AdminOS actually
-- markets itself to (app/page.tsx's `industries` list) but that the enum
-- never had a value for: creative & media, consulting, events & hospitality,
-- cleaning & facilities, accounting & bookkeeping, salons & wellness.
--
-- Until this runs, lib/onboarding/examples.ts's mapBusinessTypeToEnum() maps
-- all six of those to 'other' as a safe fallback — extending the enum lets
-- them get their own value (and, later, their own sidebar-gated features via
-- lib/nav/features.ts's `industries` arrays) without a second migration.
--
-- NOT run automatically — apply via Supabase dashboard/CLI or the
-- Management API. ALTER TYPE ... ADD VALUE cannot run inside the same
-- transaction as a later statement that uses the new value, but each ADD
-- VALUE below is safe to run in one batch; nothing in this file uses the
-- new values.

ALTER TYPE business_type ADD VALUE IF NOT EXISTS 'creative';
ALTER TYPE business_type ADD VALUE IF NOT EXISTS 'consulting';
ALTER TYPE business_type ADD VALUE IF NOT EXISTS 'events';
ALTER TYPE business_type ADD VALUE IF NOT EXISTS 'cleaning';
ALTER TYPE business_type ADD VALUE IF NOT EXISTS 'accounting';
ALTER TYPE business_type ADD VALUE IF NOT EXISTS 'salons';
