-- Langa conversation history
-- Stores chat sessions between users and Langa AI mentor

CREATE TABLE IF NOT EXISTS langa_conversations (
  id          UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id   UUID    NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id     UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT,                  -- auto-generated from first message
  messages    JSONB   NOT NULL DEFAULT '[]',
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE langa_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "langa_conversations_own" ON langa_conversations
  USING (user_id = auth.uid());

CREATE INDEX langa_conversations_user_idx ON langa_conversations (user_id, updated_at DESC);
CREATE INDEX langa_conversations_tenant_idx ON langa_conversations (tenant_id, updated_at DESC);

-- Fix academy_certificates: add unique constraint on (user_id, module_id) for upsert support
-- Add a full unique constraint so Supabase upsert can use it as a conflict target
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'academy_certificates_user_module_unique'
  ) THEN
    ALTER TABLE academy_certificates
      ADD CONSTRAINT academy_certificates_user_module_unique
      UNIQUE (user_id, module_id);
  END IF;
END $$;
