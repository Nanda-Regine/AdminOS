-- Phase 10 helpers
-- Full-text search RPC for knowledge base
-- Social webhook support columns

-- ─── KB Full-Text Search RPC ──────────────────────────────────────────────────
-- Used by GET /api/kb?q=... for fast full-text search via GIN index

CREATE OR REPLACE FUNCTION search_kb_articles(
  p_tenant_id UUID,
  p_query     TEXT,
  p_limit     INT DEFAULT 20
)
RETURNS TABLE (
  id            UUID,
  title         TEXT,
  category_id   UUID,
  tags          TEXT[],
  created_at    TIMESTAMPTZ,
  published     BOOLEAN,
  rank          FLOAT4
)
LANGUAGE SQL STABLE SECURITY DEFINER AS $$
  SELECT
    id,
    title,
    category_id,
    tags,
    created_at,
    published,
    ts_rank(to_tsvector('english', title || ' ' || content), plainto_tsquery('english', p_query)) AS rank
  FROM kb_articles
  WHERE
    tenant_id = p_tenant_id
    AND to_tsvector('english', title || ' ' || content) @@ plainto_tsquery('english', p_query)
  ORDER BY rank DESC
  LIMIT p_limit;
$$;

-- ─── Social Inbox: add tenant_id to social_messages ──────────────────────────
-- The Phase 9-11 migration did not include tenant_id on social_messages.
-- This is required for proper RLS and multi-tenant isolation.

-- Check if column already exists first
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'social_messages' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE social_messages ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ─── EMP201 data column on payroll_runs ───────────────────────────────────────
-- Cache EMP201 data to avoid regenerating on each request

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payroll_runs' AND column_name = 'emp201_data'
  ) THEN
    ALTER TABLE payroll_runs ADD COLUMN emp201_data JSONB;
  END IF;
END $$;

-- ─── Add is_public alias for kb_articles (used in Phase 11 public widget) ────
-- Actually: the column is 'published', not 'is_public'. This is a no-op
-- migration that documents the correct column name for future reference.
-- Reference: kb_articles.published = TRUE means it is public in the widget.

-- ─── Framework library: add GIN index on situation_tags if missing ────────────
CREATE INDEX IF NOT EXISTS framework_situation_tags_gin
  ON framework_library USING GIN (situation_tags);

-- ─── Sector benchmarks table: add index if missing ───────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS sector_benchmarks_type_metric_idx
  ON sector_benchmarks (business_type, metric_name);
