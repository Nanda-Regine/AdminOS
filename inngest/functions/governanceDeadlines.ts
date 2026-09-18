import { inngest } from '@/inngest/client'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { buildGovernanceIntel } from '@/lib/governance/signal'
import { notifyTenant } from '@/lib/notifications/notify'
import { getTenantAutonomy } from '@/lib/autonomy/config'
import { resolveTier, tierAllowsWhatsapp } from '@/lib/autonomy/tiers'

// Autonomy: governance/deadline_alert (default A). The compliance calendar
// (app/dashboard/compliance) already shows every SARS/CIPC/Compensation Fund
// deadline when the owner looks — this is the proactive push so they don't
// have to look. Fires only at fixed checkpoints (not daily) to avoid nagging
// on a deadline that's still weeks out.
const CHECKPOINT_DAYS = new Set([14, 7, 3, 1, 0])

export const deadlineAlertCron = inngest.createFunction(
  { id: 'deadline-alert-cron', retries: 0, triggers: [{ cron: 'TZ=Africa/Johannesburg 0 7 * * *' }] },
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
        tenants.map((t: any) => ({ name: 'adminos/governance.deadline-check' as const, data: { tenant_id: t.id } })),
      )
    })
    return { fanned: tenants.length }
  },
)

export const deadlineAlertEngine = inngest.createFunction(
  { id: 'deadline-alert-engine', retries: 2, triggers: [{ event: 'adminos/governance.deadline-check' }] },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async ({ event, step }: any) => {
    const { tenant_id } = event.data as { tenant_id: string }

    const due = await step.run('compute-deadlines', async () => {
      const intel = await buildGovernanceIntel(tenant_id)
      return intel.deadlines.filter(d => d.daysLeft !== null && CHECKPOINT_DAYS.has(d.daysLeft))
    })
    if (!due.length) return { tenant_id, status: 'none' }

    await step.run('notify', async () => {
      const tier = resolveTier(await getTenantAutonomy(tenant_id), 'governance', 'deadline_alert')
      const today = new Date().toISOString().slice(0, 10)
      for (const d of due) {
        const when = d.daysLeft === 0 ? 'due today' : `due in ${d.daysLeft} day${d.daysLeft === 1 ? '' : 's'}`
        await notifyTenant(tenant_id, {
          type: 'governance.deadline',
          title: `${d.title} — ${when}`,
          body: d.penalty ? `${d.penalty}` : `Statutory deadline ${when}.`,
          actionUrl: '/dashboard/compliance',
          dedupeKey: `deadline-${tenant_id}-${d.title}-${d.daysLeft}-${today}`,
          dedupeHours: 30,
          whatsapp: tierAllowsWhatsapp(tier),
        })
      }
    })

    return { tenant_id, status: 'notified', count: due.length }
  },
)
