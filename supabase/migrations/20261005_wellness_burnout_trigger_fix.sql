-- 2026-10-05 (Session 19) — fn_trigger_burnout_alert broke wellness check-ins.
--
-- staff.wellness_scores holds objects: [{ "score": 4, "date": "2026-10-05" }, …]
-- (lib/workflow/engine.ts, lib/workflows/wellness.ts). The trigger cast each
-- element straight to numeric — `val::text::numeric` on '{"score": 4, …}' —
-- which raises "invalid input syntax for type numeric". It only runs once an
-- array has 3+ entries, so every person's 4th check-in onwards made the UPDATE
-- fail, and both writers ignored the error: wellness tracking silently froze
-- after three check-ins. It also averaged the OLDEST seven (LIMIT 7 without
-- ORDER BY), not the most recent.
--
-- Fix: read `score` from objects (bare numbers still accepted), take the last
-- seven by array position, and never let a malformed element block the save.

CREATE OR REPLACE FUNCTION public.fn_trigger_burnout_alert()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  avg_score   numeric;
  score_count int;
BEGIN
  IF NEW.wellness_scores IS NULL OR jsonb_typeof(NEW.wellness_scores) <> 'array'
     OR jsonb_array_length(NEW.wellness_scores) < 3 THEN
    RETURN NEW;
  END IF;

  SELECT AVG(v), COUNT(*) INTO avg_score, score_count
  FROM (
    SELECT CASE
             WHEN jsonb_typeof(e.val) = 'number' THEN e.val::text::numeric
             WHEN jsonb_typeof(e.val) = 'object' AND jsonb_typeof(e.val -> 'score') = 'number'
               THEN (e.val ->> 'score')::numeric
           END AS v
    FROM jsonb_array_elements(NEW.wellness_scores) WITH ORDINALITY AS e(val, idx)
    ORDER BY e.idx DESC
    LIMIT 7
  ) recent
  WHERE v IS NOT NULL;

  IF score_count >= 3 AND avg_score < 2.5 THEN
    INSERT INTO workflow_queue (tenant_id, workflow_type, payload)
    SELECT NEW.tenant_id, 'burnout_alert', jsonb_build_object(
      'staff_id',    NEW.id,
      'staff_name',  NEW.full_name,
      'phone',       NEW.phone,
      'avg_score',   ROUND(avg_score, 2),
      'score_count', score_count
    )
    WHERE NOT EXISTS (
      SELECT 1 FROM workflow_queue
      WHERE tenant_id = NEW.tenant_id
        AND workflow_type = 'burnout_alert'
        AND payload->>'staff_id' = NEW.id::text
        AND created_at > now() - interval '48 hours'
    );
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- An alert is a nice-to-have; losing the check-in itself is not.
  RAISE WARNING 'fn_trigger_burnout_alert skipped for staff %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;
