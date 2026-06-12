-- Phase 0.5 — Priority Queue
-- Add priority column + optimised index so high-value tenants get served first

ALTER TABLE workflow_queue
  ADD COLUMN IF NOT EXISTS priority INT NOT NULL DEFAULT 5;

-- Priority scale (lower number = higher priority, consistent with most queue systems):
-- 1 = partner / white_label  (SLA: process immediately)
-- 2 = scale / enterprise     (SLA: within 1 batch)
-- 3 = operate / business     (SLA: within 2 batches)
-- 4 = grow / starter         (SLA: within 4 batches)
-- 5 = solo / trial           (default)

COMMENT ON COLUMN workflow_queue.priority IS
  '1=partner,2=scale,3=operate,4=grow,5=solo — lower number processed first';

-- Partial index: only pending jobs need priority ordering
CREATE INDEX IF NOT EXISTS workflow_queue_priority_idx
  ON workflow_queue (priority ASC, next_attempt_at ASC)
  WHERE status = 'pending';

-- Back-fill existing rows: set priority based on the tenant plan
-- Runs once on migration, safe to run on live data
UPDATE workflow_queue wq
SET priority = (
  SELECT CASE t.plan
    WHEN 'partner'      THEN 1
    WHEN 'white_label'  THEN 1
    WHEN 'scale'        THEN 2
    WHEN 'enterprise'   THEN 2
    WHEN 'operate'      THEN 3
    WHEN 'business'     THEN 3
    WHEN 'grow'         THEN 4
    WHEN 'starter'      THEN 4
    ELSE                     5
  END
  FROM tenants t
  WHERE t.id = wq.tenant_id
)
WHERE wq.status = 'pending';
