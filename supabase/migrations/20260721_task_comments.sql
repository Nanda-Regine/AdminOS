-- task_comments: the /api/tasks/[id]/comments route (GET + POST) reads and writes
-- this table, but it was never created — every comment POST 400'd ("Could not find
-- the table public.task_comments"). This creates it to match the route's insert
-- (task_id, tenant_id, user_id, body) and read (select * order by created_at),
-- following the standard tenant-scoped + RLS pattern used across the schema.

CREATE TABLE IF NOT EXISTS public.task_comments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id    uuid NOT NULL REFERENCES public.tasks(id)   ON DELETE CASCADE,
  tenant_id  uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL,
  body       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_comments_task   ON public.task_comments (task_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_tenant ON public.task_comments (tenant_id);

ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS task_comments_tenant ON public.task_comments;
CREATE POLICY task_comments_tenant ON public.task_comments
  FOR ALL USING (tenant_id = public.current_tenant_id());
