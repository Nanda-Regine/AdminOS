-- Phase 1 — Employee OS: My Admin
-- Staff enhancements + clock events + shifts + expenses + disciplinary + announcements + performance

-- ─── Staff table enhancements ─────────────────────────────────────────────────

ALTER TABLE staff ADD COLUMN IF NOT EXISTS job_title           TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS employment_type     TEXT NOT NULL DEFAULT 'full_time'
  CHECK (employment_type IN ('full_time','part_time','contract','casual','intern'));
ALTER TABLE staff ADD COLUMN IF NOT EXISTS start_date          DATE;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS salary              NUMERIC(12,2);
ALTER TABLE staff ADD COLUMN IF NOT EXISTS bank_account_number TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS bank_name           TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS id_number           TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS emergency_contact_name  TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS address             TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS user_id             UUID REFERENCES auth.users(id);

CREATE UNIQUE INDEX IF NOT EXISTS staff_user_id_tenant_idx ON staff (user_id, tenant_id)
  WHERE user_id IS NOT NULL;

-- ─── Clock in/out ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS clock_events (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id     UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  staff_id      UUID        NOT NULL REFERENCES staff(id)   ON DELETE CASCADE,
  event_type    TEXT        NOT NULL CHECK (event_type IN ('clock_in','clock_out','break_start','break_end')),
  timestamp     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  lat           NUMERIC(10,7),
  lng           NUMERIC(10,7),
  location_name TEXT,
  device_id     TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX clock_events_staff_date_idx ON clock_events (staff_id, timestamp DESC);
ALTER TABLE clock_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clock_events_tenant" ON clock_events
  USING (tenant_id = (auth.jwt() -> 'tenant_id')::uuid);

-- ─── Shift rosters ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS shifts (
  id          UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id   UUID    NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  staff_id    UUID    NOT NULL REFERENCES staff(id)   ON DELETE CASCADE,
  shift_date  DATE    NOT NULL,
  start_time  TIME    NOT NULL,
  end_time    TIME    NOT NULL,
  location    TEXT,
  notes       TEXT,
  status      TEXT    NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled','confirmed','swapped','absent')),
  created_by  UUID,
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX shifts_staff_date_idx   ON shifts (staff_id, shift_date);
CREATE INDEX shifts_tenant_date_idx  ON shifts (tenant_id, shift_date);
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shifts_tenant" ON shifts
  USING (tenant_id = (auth.jwt() -> 'tenant_id')::uuid);

-- ─── Expense claims ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS expenses (
  id                   UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id            UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  staff_id             UUID        NOT NULL REFERENCES staff(id)   ON DELETE CASCADE,
  amount               NUMERIC(12,2) NOT NULL,
  category             TEXT        NOT NULL,
  description          TEXT,
  receipt_url          TEXT,
  receipt_storage_path TEXT,
  status               TEXT        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected','paid')),
  submitted_at         TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  approved_by          UUID,
  approved_at          TIMESTAMPTZ,
  paid_at              TIMESTAMPTZ,
  created_at           TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX expenses_tenant_status_idx ON expenses (tenant_id, status);
CREATE INDEX expenses_staff_idx         ON expenses (staff_id);
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "expenses_tenant" ON expenses
  USING (tenant_id = (auth.jwt() -> 'tenant_id')::uuid);

-- ─── Disciplinary records ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS disciplinary_records (
  id            UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id     UUID    NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  staff_id      UUID    NOT NULL REFERENCES staff(id)   ON DELETE CASCADE,
  record_type   TEXT    NOT NULL
    CHECK (record_type IN ('verbal_warning','written_warning','final_warning','suspension','dismissal','grievance','hearing')),
  incident_date DATE    NOT NULL,
  description   TEXT    NOT NULL,
  outcome       TEXT,
  documents_url TEXT[],
  issued_by     UUID,
  acknowledged_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE disciplinary_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "disciplinary_tenant" ON disciplinary_records
  USING (tenant_id = (auth.jwt() -> 'tenant_id')::uuid);

-- ─── Announcements ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS announcements (
  id           UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id    UUID    NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title        TEXT    NOT NULL,
  body         TEXT    NOT NULL,
  audience     TEXT    NOT NULL DEFAULT 'all'
    CHECK (audience IN ('all','managers','specific')),
  audience_ids UUID[],
  pinned       BOOLEAN DEFAULT FALSE,
  published_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  expires_at   TIMESTAMPTZ,
  created_by   UUID,
  created_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS announcement_reads (
  announcement_id UUID        NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  user_id         UUID        NOT NULL REFERENCES auth.users(id)    ON DELETE CASCADE,
  read_at         TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  PRIMARY KEY (announcement_id, user_id)
);

ALTER TABLE announcements      ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcement_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "announcements_tenant" ON announcements
  USING (tenant_id = (auth.jwt() -> 'tenant_id')::uuid);
CREATE POLICY "announcement_reads_user" ON announcement_reads
  USING (user_id = auth.uid());

-- ─── Performance reviews ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS performance_reviews (
  id             UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id      UUID    NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  staff_id       UUID    NOT NULL REFERENCES staff(id)   ON DELETE CASCADE,
  reviewer_id    UUID,
  review_period  TEXT,
  ratings        JSONB,
  comments       TEXT,
  goals_set      JSONB,
  status         TEXT    NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','submitted','acknowledged')),
  created_at     TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE performance_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "performance_reviews_tenant" ON performance_reviews
  USING (tenant_id = (auth.jwt() -> 'tenant_id')::uuid);

-- ─── Push tokens (Expo notifications) ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS push_tokens (
  id         UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id  UUID    NOT NULL REFERENCES tenants(id)    ON DELETE CASCADE,
  token      TEXT    NOT NULL,
  platform   TEXT    NOT NULL CHECK (platform IN ('ios','android','web')),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE (user_id, token)
);

ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "push_tokens_own" ON push_tokens
  USING (user_id = auth.uid());

-- Realtime: subscribe to announcements for live notifications
ALTER PUBLICATION supabase_realtime ADD TABLE announcements;
ALTER PUBLICATION supabase_realtime ADD TABLE clock_events;
