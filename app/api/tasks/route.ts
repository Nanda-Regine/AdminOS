import { z } from 'zod'
import { after } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { withRoute, unwrap, badRequest } from '@/lib/api/withRoute'
import { isTenantStaff, ownStaffId } from '@/lib/people/ownStaff'
import { TASK_STATUSES, TASK_PRIORITIES, TASK_COLUMNS, compareTasks } from '@/lib/ops/tasks'
import { notifyStaffMember } from '@/lib/notifications/staff'

const createSchema = z.object({
  title:       z.string().trim().min(1).max(500),
  description: z.string().max(2000).optional(),
  projectId:   z.string().uuid().optional(),
  contactId:   z.string().uuid().optional(),
  invoiceId:   z.string().uuid().optional(),
  assignedTo:  z.string().uuid().optional(),
  priority:    z.enum(TASK_PRIORITIES).default('medium'),
  dueDate:     z.string().datetime({ offset: true }).optional(),
  source:      z.enum(['manual','agent_chase','agent_care','agent_compliance','document_expiry','contract_expiry','payroll','onboarding']).default('manual'),
})

const listQuery = z.object({
  status:     z.enum(TASK_STATUSES).optional(),
  open:       z.enum(['true', 'false']).optional(),
  mine:       z.enum(['true', 'false']).optional(),
  assignedTo: z.string().uuid().optional(),
  projectId:  z.string().uuid().optional(),
  limit:      z.coerce.number().int().min(1).max(500).default(200),
})

// GET /api/tasks — every member works the tenant's task board (tasks.read).
// ?mine=true → only tasks assigned to the caller's own staff record.
export const GET = withRoute({ action: 'tasks.read', query: listQuery }, async ({ ctx, query }) => {
  let q = supabaseAdmin
    .from('tasks')
    .select(TASK_COLUMNS)
    .eq('tenant_id', ctx.tenantId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(query.limit)

  if (query.mine === 'true') {
    const own = await ownStaffId(ctx.tenantId, ctx.userId)
    if (!own) return []
    q = q.eq('assigned_to', own)
  } else if (query.assignedTo) {
    q = q.eq('assigned_to', query.assignedTo)
  }
  if (query.status)          q = q.eq('status', query.status)
  else if (query.open === 'true') q = q.in('status', ['todo', 'in_progress', 'review'])
  if (query.projectId)       q = q.eq('project_id', query.projectId)

  const rows = unwrap(await q) ?? []
  return [...rows].sort(compareTasks)
})

// POST /api/tasks
export const POST = withRoute({
  action: 'tasks.write',
  body: createSchema,
  status: 201,
  audit: 'task.created',
  resourceType: 'task',
  rateLimit: 'api',
}, async ({ ctx, body }) => {
  // tasks.assigned_to is a staff FK with no tenant check of its own: without
  // this, a task could be assigned to another business's employee.
  if (body.assignedTo && !(await isTenantStaff(ctx.tenantId, body.assignedTo))) {
    throw badRequest('That team member was not found.')
  }

  const task = unwrap(await supabaseAdmin
    .from('tasks')
    .insert({
      tenant_id:   ctx.tenantId,
      title:       body.title,
      description: body.description ?? null,
      project_id:  body.projectId   ?? null,
      contact_id:  body.contactId   ?? null,
      invoice_id:  body.invoiceId   ?? null,
      assigned_to: body.assignedTo  ?? null,
      priority:    body.priority,
      due_date:    body.dueDate     ?? null,
      source:      body.source,
      status:      'todo',
      created_by:  ctx.userId,
    })
    .select(TASK_COLUMNS)
    .single(), { required: true })

  if (task.assigned_to) {
    const tenantId = ctx.tenantId
    after(() => notifyStaffMember(tenantId, task.assigned_to as string, {
      type: 'task_assigned',
      title: 'New task for you',
      body: task.title as string,
      route: '/tasks',
      data: { task_id: task.id },
    }))
  }
  return task
})
