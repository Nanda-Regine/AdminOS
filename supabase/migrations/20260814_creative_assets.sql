-- Creative Assets — deliverable tracking for media/creative-service tenants
-- 2026-08-14 · Mirembe Muse (Pty) Ltd
--
-- Built for a real gap: AdminOS's `documents` table/upload route is for
-- business paperwork (contracts, invoices, HR — AI-extracted text, 10MB cap,
-- no audio/video MIME types). A video/audio production business needs to
-- track its actual deliverables, which don't fit that shape at all — no text
-- to extract, files that can be hundreds of MB to several GB.
--
-- Two storage modes, chosen per asset:
--   'hosted'   — small files (audio, short clips) uploaded directly to
--                Cloudinary via a server-signed upload (see
--                app/api/creative-assets/upload-signature/route.ts). The
--                binary never touches our Next.js API route — Vercel
--                serverless functions cap request bodies far below what a
--                real video file needs, so client -> Cloudinary direct
--                upload isn't just nicer, it's required.
--   'external' — anything larger (or already hosted elsewhere — Drive,
--                Dropbox, Frame.io, Vimeo). We track a link + metadata only.
--                No storage/bandwidth cost to us for this mode.
--
-- Uses current_tenant_id() from the start — see
-- 20260814_phase0_followup2_live_discovered.sql for why that's non-negotiable.

DO $$ BEGIN
  CREATE TYPE creative_asset_category AS ENUM (
    'audio', 'voice_over', 'soundtrack', 'video_long', 'video_short', 'finished_work'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE creative_asset_status AS ENUM (
    'draft', 'in_review', 'approved', 'delivered'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS creative_assets (
  id                       UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id                UUID    NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contact_id               UUID    REFERENCES contacts(id) ON DELETE SET NULL,
  title                    TEXT    NOT NULL,
  category                 creative_asset_category NOT NULL,
  status                   creative_asset_status NOT NULL DEFAULT 'draft',
  storage_mode             TEXT    NOT NULL CHECK (storage_mode IN ('hosted', 'external')),

  -- 'hosted' fields — populated after a direct-to-Cloudinary upload completes
  cloudinary_public_id     TEXT,
  cloudinary_url           TEXT,
  cloudinary_resource_type TEXT,   -- 'video' (also covers audio) | 'image'
  file_size_bytes          BIGINT,

  -- 'external' fields — a link the tenant already hosts elsewhere
  external_url             TEXT,
  external_provider        TEXT,   -- 'drive' | 'dropbox' | 'frameio' | 'vimeo' | 'other'

  notes                    TEXT,
  created_by                UUID    REFERENCES auth.users(id),
  created_at                TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at                TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  CONSTRAINT creative_assets_storage_shape CHECK (
    (storage_mode = 'hosted'   AND cloudinary_url IS NOT NULL AND external_url IS NULL) OR
    (storage_mode = 'external' AND external_url   IS NOT NULL AND cloudinary_url IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS creative_assets_tenant_category_idx ON creative_assets (tenant_id, category);
CREATE INDEX IF NOT EXISTS creative_assets_tenant_status_idx   ON creative_assets (tenant_id, status);
CREATE INDEX IF NOT EXISTS creative_assets_contact_idx         ON creative_assets (contact_id);

DROP TRIGGER IF EXISTS creative_assets_updated_at ON creative_assets;
CREATE TRIGGER creative_assets_updated_at
  BEFORE UPDATE ON creative_assets
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE creative_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "creative_assets_tenant" ON creative_assets;
CREATE POLICY "creative_assets_tenant" ON creative_assets
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());
