import { inngest } from '@/inngest/client'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { notifyTenant } from '@/lib/notifications/notify'
import { getTenantAutonomy } from '@/lib/autonomy/config'
import { resolveTier, tierAllowsWhatsapp } from '@/lib/autonomy/tiers'

// Expense submission already fires a one-time alert (app/api/expenses/route.ts
// → notifyTenant('approval.needed')). This is the separate nudge for
// approvals (leave + expenses) that have sat untouched — autonomy decision
// people/approval_reminder (default A). Daily, fans over active tenants.
const STALE_AFTER_HOURS = 48

export const approvalReminderCron = inngest.createFunction(
  { id: 'approval-reminder-cron', retries: 0, triggers: [{ cron: 'TZ=Africa/Johannesburg 0 8 * * *' }] },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async ({ step }: any) => {
    const tenants = await step.run('fetch-tenants', async () => {
      const { data } = await supabaseAdmin.from('tenants').select('id').eq('active', true)
      return data ?? []
    })
    if (!tenants.length) return { fanned: 0 }

    await step.run('send-events', async () => {
      await inngest.send(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tenants.map((t: any) => ({ name: 'adminos/people.approval-check' as const, data: { tenant_id: t.id } })),
      )
    })
    return { fanned: tenants.length }
  },
)

export const approvalReminderEngine = inngest.createFunction(
  { id: 'approval-reminder-engine', retries: 2, triggers: [{ event: 'adminos/people.approval-check' }] },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async ({ event, step }: any) => {
    const { tenant_id } = event.data as { tenant_id: string }
    const cutoff = new Date(Date.now() - STALE_AFTER_HOURS * 3600000).toISOString()

    const stale = await step.run('fetch-stale-approvals', async () => {
      const [leaveRes, expRes] = await Promise.all([
        supabaseAdmin.from('leave_requests').select('id, created_at').eq('tenant_id', tenant_id).eq('status', 'pending').lte('created_at', cutoff),
        supabaseAdmin.from('expenses').select('id, submitted_at').eq('tenant_id', tenant_id).eq('status', 'pending').lte('submitted_at', cutoff),
      ])
      return { leave: leaveRes.data ?? [], expenses: expRes.data ?? [] }
    })

    const total = stale.leave.length + stale.expenses.length
    if (!total) return { tenant_id, status: 'none' }

    await step.run('notify', async () => {
      const tier = resolveTier(await getTenantAutonomy(tenant_id), 'people', 'approval_reminder')
      const today = new Date().toISOString().slice(0, 10)
      const parts: string[] = []
      if (stale.leave.length) parts.push(`${stale.leave.length} leave request${stale.leave.length === 1 ? '' : 's'}`)
      if (stale.expenses.length) parts.push(`${stale.expenses.length} expense claim${stale.expenses.length === 1 ? '' : 's'}`)
      await notifyTenant(tenant_id, {
        type: 'people.approval_reminder',
        title: `${total} approval${total === 1 ? '' : 's'} waiting on you`,
        body: `${parts.join(' and ')} ${total === 1 ? 'has' : 'have'} been pending ${STALE_AFTER_HOURS / 24}+ days.`,
        actionUrl: '/dashboard/people',
        dedupeKey: `approval-reminder-${tenant_id}-${today}`,
        dedupeHours: 20,
        whatsapp: tierAllowsWhatsapp(tier),
      })
    })

    return { tenant_id, status: 'notified', count: total }
  },
)
