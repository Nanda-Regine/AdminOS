import { supabaseAdmin } from '@/lib/supabase/admin'
import { notify } from '@/lib/notifications/notify'
import { pushToUsers } from '@/lib/notifications/push'

/**
 * Tell one employee something about their own records — leave decided, claim
 * approved, payslip ready. In-app (addressed to their login, so only they see
 * it) plus a push to their phone. Silently does nothing for staff with no
 * linked login. Never throws: the decision that triggered it already happened.
 */
export async function notifyStaffMember(
  tenantId: string,
  staffId: string,
  n: { type: string; title: string; body: string; route?: string; data?: Record<string, unknown> },
): Promise<void> {
  try {
    const { data: staff } = await supabaseAdmin
      .from('staff')
      .select('user_id')
      .eq('id', staffId)
      .eq('tenant_id', tenantId)
      .maybeSingle()
    const userId = staff?.user_id as string | null | undefined
    if (!userId) return
    await notify({ tenantId, userId, type: n.type, title: n.title, body: n.body, data: n.data })
    await pushToUsers(tenantId, [userId], { title: n.title, body: n.body, route: n.route, data: n.data })
  } catch (e) {
    console.error('[notifyStaffMember]', e)
  }
}
