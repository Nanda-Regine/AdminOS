-- Phase 3 — Business Academy + Langa + Indaba Framework Library

-- ─── Academy modules and lessons ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS academy_modules (
  id                UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  level             TEXT    NOT NULL CHECK (level IN ('foundation','momentum','mastery','legacy')),
  module_number     INT     NOT NULL,
  title             TEXT    NOT NULL,
  description       TEXT,
  business_types    TEXT[]  DEFAULT ARRAY['all'],
  min_plan          TEXT    NOT NULL DEFAULT 'solo',
  estimated_minutes INT,
  unlock_condition  JSONB,
  created_at        TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE (level, module_number)
);

CREATE TABLE IF NOT EXISTS academy_lessons (
  id                UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  module_id         UUID    NOT NULL REFERENCES academy_modules(id) ON DELETE CASCADE,
  lesson_number     INT     NOT NULL,
  title             TEXT    NOT NULL,
  content_type      TEXT    NOT NULL DEFAULT 'text'
    CHECK (content_type IN ('text','interactive','book_in_action','exercise')),
  content           JSONB   NOT NULL,
  estimated_minutes INT,
  trigger_events    TEXT[],
  created_at        TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE (module_id, lesson_number)
);

-- ─── Learner progress ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS academy_progress (
  id           UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id    UUID    NOT NULL REFERENCES tenants(id)         ON DELETE CASCADE,
  user_id      UUID    NOT NULL REFERENCES auth.users(id)      ON DELETE CASCADE,
  lesson_id    UUID    NOT NULL REFERENCES academy_lessons(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ,
  score        NUMERIC(5,2),
  time_spent_seconds INT,
  created_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE (user_id, lesson_id)
);

ALTER TABLE academy_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "academy_progress_own" ON academy_progress
  USING (user_id = auth.uid());

-- ─── Certificates ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS academy_certificates (
  id                UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id         UUID    NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id           UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  certificate_type  TEXT    NOT NULL
    CHECK (certificate_type IN ('foundation','business_builder','acbo','module')),
  module_id         UUID    REFERENCES academy_modules(id),
  issued_at         TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  certificate_url   TEXT,
  verification_code TEXT    UNIQUE DEFAULT gen_random_uuid()::TEXT NOT NULL
);

ALTER TABLE academy_certificates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "certificates_own" ON academy_certificates
  USING (user_id = auth.uid());

-- ─── Achievements ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS achievements (
  id          UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  slug        TEXT    UNIQUE NOT NULL,
  name        TEXT    NOT NULL,
  description TEXT,
  icon        TEXT,
  category    TEXT    CHECK (category IN ('milestone','compliance','learning','financial','team','community')),
  criteria    JSONB   NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS user_achievements (
  id             UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id      UUID    NOT NULL REFERENCES tenants(id)    ON DELETE CASCADE,
  user_id        UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id UUID    NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  earned_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE (user_id, achievement_id)
);

ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "achievements_own" ON user_achievements
  USING (user_id = auth.uid());

-- ─── Learning streaks ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS learning_streaks (
  user_id            UUID    PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id          UUID    NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  current_streak     INT     NOT NULL DEFAULT 0,
  longest_streak     INT     NOT NULL DEFAULT 0,
  last_activity_date DATE,
  streak_broken_at   TIMESTAMPTZ,
  updated_at         TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE learning_streaks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "streaks_own" ON learning_streaks
  USING (user_id = auth.uid());

-- ─── Indaba Framework Library ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS framework_library (
  id                 UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  slug               TEXT    UNIQUE NOT NULL,
  book_title         TEXT    NOT NULL,
  author             TEXT    NOT NULL,
  framework_name     TEXT    NOT NULL,
  core_insight       TEXT    NOT NULL,
  detailed_content   JSONB   NOT NULL,
  situation_tags     TEXT[],
  business_stage     TEXT[]  DEFAULT ARRAY['foundation','momentum','mastery','legacy'],
  business_types     TEXT[]  DEFAULT ARRAY['all'],
  urgency            TEXT    NOT NULL DEFAULT 'opportunity'
    CHECK (urgency IN ('crisis','warning','opportunity')),
  data_fields_needed TEXT[],
  action_label       TEXT,
  action_route       TEXT,
  created_at         TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX framework_library_tags_idx ON framework_library USING GIN (situation_tags);

-- ─── Contextual learning triggers ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS contextual_triggers (
  id               UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type       TEXT    NOT NULL,
  condition        JSONB,
  framework_slug   TEXT    REFERENCES framework_library(slug),
  lesson_id        UUID    REFERENCES academy_lessons(id),
  message_template TEXT,
  cooldown_hours   INT     NOT NULL DEFAULT 168,  -- 1 week default
  created_at       TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX contextual_triggers_event_idx ON contextual_triggers (event_type);

CREATE TABLE IF NOT EXISTS triggered_lessons (
  id           UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id    UUID    NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id      UUID    NOT NULL,
  trigger_id   UUID    REFERENCES contextual_triggers(id),
  triggered_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  dismissed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS book_in_action_completions (
  id             UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id      UUID    NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id        UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  framework_slug TEXT    NOT NULL REFERENCES framework_library(slug),
  completed_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  outputs        JSONB
);

-- ─── Realtime ────────────────────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE academy_progress;
ALTER PUBLICATION supabase_realtime ADD TABLE user_achievements;
