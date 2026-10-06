import { supabaseAdmin } from '@/lib/supabase/admin'
import { seesOnlyOwnData } from '@/lib/auth/roleMatrix'
import { ownStaffId } from '@/lib/people/ownStaff'

type Caller = { tenantId: string; userId: string; permissions: readonly string[]; isSuperAdmin?: boolean }

/**
 * PostgREST `.or()` filter limiting a tasks query to what the caller may see,
 * or null when they may see the whole board.
 *
 * Own-data roles (staff, field_agent, client) see tasks assigned to their
 * staff row or created by them. Before this, any member — including the
 * external `client` role — read every task in the tenant.
 * Both ids are server-resolved UUIDs, never user input.
 */
export async function taskVisibilityFilter(ctx: Caller): Promise<string | null> {
  if (!seesOnlyOwnData(ctx)) return null
  const own = await ownStaffId(ctx.tenantId, ctx.userId)
  return own
    ? `assigned_to.eq.${own},created_by.eq.${ctx.userId}`
    : `created_by.eq.${ctx.userId}`
}

/** Whether the caller may see one task — for routes nested under a task id. */
export async function canSeeTask(ctx: Caller, taskId: string): Promise<boolean> {
  let q = supabaseAdmin
    .from('tasks')
    .select('id')
    .eq('id', taskId)
    .eq('tenant_id', ctx.tenantId)
    .is('deleted_at', null)
  const scope = await taskVisibilityFilter(ctx)
  if (scope) q = q.or(scope)
  const { data } = await q.maybeSingle()
  return data != null
}
