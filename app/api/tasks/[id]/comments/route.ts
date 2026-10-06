import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { withRoute, unwrap, notFound } from '@/lib/api/withRoute'
import { canSeeTask } from '@/lib/ops/taskScope'

const COMMENT_COLUMNS = 'id, task_id, user_id, body, created_at'

const createSchema = z.object({
  body: z.string().trim().min(1).max(5000),
})

// Comments follow the task's visibility: own-data roles may only read and
// comment on tasks assigned to or created by them (lib/ops/taskScope.ts).
// Before this, the route used bare getUser + select * + raw DB errors, and
// any member could read the thread on any task by id.

export const GET = withRoute({ action: 'tasks.read' }, async ({ ctx, params }) => {
  if (!(await canSeeTask(ctx, params.id))) throw notFound('Task not found')
  return unwrap(await supabaseAdmin
    .from('task_comments')
    .select(COMMENT_COLUMNS)
    .eq('task_id', params.id)
    .eq('tenant_id', ctx.tenantId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(500)) ?? []
})

export const POST = withRoute({
  action: 'tasks.write',
  body: createSchema,
  status: 201,
  audit: 'task.commented',
  resourceType: 'task',
  rateLimit: 'api',
}, async ({ ctx, body, params }) => {
  if (!(await canSeeTask(ctx, params.id))) throw notFound('Task not found')
  return unwrap(await supabaseAdmin
    .from('task_comments')
    .insert({ task_id: params.id, tenant_id: ctx.tenantId, user_id: ctx.userId, body: body.body })
    .select(COMMENT_COLUMNS)
    .single(), { required: true })
})
