-- Mobile: in-app notifications table for the Expo app

CREATE TABLE IF NOT EXISTS notifications (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id  UUID        REFERENCES tenants(id) ON DELETE CASCADE,
  type       TEXT        NOT NULL,
  title      TEXT        NOT NULL,
  body       TEXT        NOT NULL,
  read       BOOLEAN     NOT NULL DEFAULT FALSE,
  action_url TEXT,
  data       JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX notifications_user_idx    ON notifications (user_id, created_at DESC);
CREATE INDEX notifications_unread_idx  ON notifications (user_id) WHERE read = FALSE;

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifications_own" ON notifications
  USING (user_id = auth.uid());

ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
