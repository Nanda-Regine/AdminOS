import { z } from 'zod'
import { after } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { withRoute, unwrap, badRequest, RouteError } from '@/lib/api/withRoute'
import { can } from '@/lib/auth/roleMatrix'
import { isTenantStaff, ownStaffId } from '@/lib/people/ownStaff'
import { TASK_STATUSES, TASK_PRIORITIES, TASK_COLUMNS } from '@/lib/ops/tasks'
import { notifyStaffMember } from '@/lib/notifications/staff'

const updateSchema = z.object({
  status:      z.enum(TASK_STATUSES).optional(),
  title:       z.string().trim().min(1).max(500).optional(),
  description: z.string().max(2000).optional(),
  assignedTo:  z.string().uuid().nullable().optional(),
  priority:    z.enum(TASK_PRIORITIES).optional(),
  dueDate:     z.string().datetime({ offset: true }).nullable().optional(),
})

/**
 * Managers (manage_staff) may change any task. Everyone else may change a task
 * assigned to them or created by them — before this, any member could rewrite,
 * reassign or delete anyone's task, including AI-created collections tasks.
 */
async function loadEditable(ctx: { tenantId: string; userId: string; permissions: readonly string[]; isSuperAdmin: boolean }, id: string) {
  const task = unwrap(await supabaseAdmin
    .from('tasks')
    .select('id, assigned_to, created_by, status, title')
    .eq('id', id)
    .eq('tenant_id', ctx.tenantId)
    .is('deleted_at', null)
    .maybeSingle(), { required: true, what: 'Task not found' })

  if (!can(ctx, 'staff.write') && task.created_by !== ctx.userId) {
    const own = await ownStaffId(ctx.tenantId, ctx.userId)
    if (!own || task.assigned_to !== own) {
      throw new RouteError(403, 'You can only change tasks assigned to you or created by you.', 'forbidden')
    }
  }
  return task
}

export const PATCH = withRoute({
  action: 'tasks.write',
  body: updateSchema,
  audit: 'task.updated',
  resourceType: 'task',
}, async ({ ctx, body, params }) => {
  const before = await loadEditable(ctx, params.id)

  if (body.assignedTo && !(await isTenantStaff(ctx.tenantId, body.assignedTo))) {
    throw badRequest('That team member was not found.')
  }

  const updates: Record<string, unknown> = {}
  if (body.status      !== undefined) updates.status      = body.status
  if (body.title       !== undefined) updates.title       = body.title
  if (body.description !== undefined) updates.description = body.description
  if (body.assignedTo  !== undefined) updates.assigned_to = body.assignedTo
  if (body.priority    !== undefined) updates.priority    = body.priority
  if (body.dueDate     !== undefined) updates.due_date    = body.dueDate
  if (body.status !== undefined) {
    // Re-opening clears the completion time instead of leaving a stale one.
    updates.completed_at = body.status === 'done' ? new Date().toISOString() : null
  }
  if (Object.keys(updates).length === 0) throw badRequest('Nothing to update.')

  const task = unwrap(await supabaseAdmin
    .from('tasks')
    .update(updates)
    .eq('id', params.id)
    .eq('tenant_id', ctx.tenantId)
    .is('deleted_at', null)
    .select(TASK_COLUMNS)
    .maybeSingle(), { required: true, what: 'Task not found' })

  if (body.assignedTo && body.assignedTo !== before.assigned_to) {
    const tenantId = ctx.tenantId
    after(() => notifyStaffMember(tenantId, body.assignedTo as string, {
      type: 'task_assigned', title: 'New task for you', body: task.title as string, route: '/tasks', data: { task_id: task.id },
    }))
  }
  return task
})

// DELETE — soft delete (Rule #3); it used to hard-delete.
export const DELETE = withRoute({
  action: 'tasks.write',
  audit: 'task.deleted',
  resourceType: 'task',
}, async ({ ctx, params }) => {
  await loadEditable(ctx, params.id)
  unwrap(await supabaseAdmin
    .from('tasks')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', params.id)
    .eq('tenant_id', ctx.tenantId)
    .is('deleted_at', null))
  return { id: params.id, deleted: true }
})
