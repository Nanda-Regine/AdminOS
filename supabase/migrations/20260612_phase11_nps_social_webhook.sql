-- NPS survey reminder tracking
ALTER TABLE nps_surveys
  ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;

-- Social inbox webhook support
-- Unique constraint required for upsert deduplication in webhook handler
ALTER TABLE social_messages
  ADD COLUMN IF NOT EXISTS external_message_id TEXT,
  ADD COLUMN IF NOT EXISTS sender_id           TEXT,
  ADD COLUMN IF NOT EXISTS sender_name         TEXT,
  ADD COLUMN IF NOT EXISTS message_type        TEXT DEFAULT 'dm',
  ADD COLUMN IF NOT EXISTS reply_content       TEXT,
  ADD COLUMN IF NOT EXISTS replied_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sentiment           TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS social_messages_dedup_idx
  ON social_messages (platform, external_message_id)
  WHERE external_message_id IS NOT NULL;

-- Social accounts unique constraint for platform+account_id upsert
ALTER TABLE social_accounts
  ADD COLUMN IF NOT EXISTS account_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS social_accounts_platform_account_idx
  ON social_accounts (tenant_id, platform, account_id)
  WHERE account_id IS NOT NULL;

-- Board pack tables (Scale/Partner feature)
CREATE TABLE IF NOT EXISTS board_packs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  generated_by  UUID NOT NULL REFERENCES auth.users(id),
  period_label  TEXT NOT NULL,  -- e.g. "Q2 2026", "June 2026"
  period_start  DATE NOT NULL,
  period_end    DATE NOT NULL,
  pack_data     JSONB NOT NULL DEFAULT '{}',
  pdf_url       TEXT,
  status        TEXT NOT NULL DEFAULT 'generating' CHECK (status IN ('generating','ready','failed')),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE board_packs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON board_packs
  USING (tenant_id = (SELECT (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid));

-- NPS survey public access (for survey submission without login)
-- Survey token must match
CREATE POLICY "public_survey_submit" ON nps_surveys
  FOR UPDATE USING (true) WITH CHECK (survey_token IS NOT NULL);
