-- 2026-10-26 — Job heartbeats (Plan v2 step 8).
--
-- A scheduled job that stops running looks exactly like a quiet day: nothing
-- errors, nothing shows. Each important cron now records "I finished OK" (or
-- "I failed") into ONE row per job, so a job that has gone silent past its
-- expected window can be shown on the dashboard and workflow monitor.
--
-- One row per job (upsert) — no growth, even for the every-5-minutes job.
-- Platform-level, not per tenant. SERVICE ROLE ONLY; read via lib/jobs/status.ts.

CREATE TABLE IF NOT EXISTS job_heartbeats (
  job_id         text PRIMARY KEY CHECK (length(job_id) BETWEEN 2 AND 80),
  last_ok_at     timestamptz,
  last_error_at  timestamptz,
  last_error     text,
  ok_count       bigint NOT NULL DEFAULT 0,
  updated_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE job_heartbeats ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON job_heartbeats FROM PUBLIC, anon, authenticated;
