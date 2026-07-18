import { inngest } from '@/inngest/client'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { refreshMoneySignal } from '@/lib/money/signal'
import { refreshOpsSignal } from '@/lib/ops/signal'
import { refreshSalesSignal } from '@/lib/sales/signal'
import { refreshPeopleSignal } from '@/lib/people/signal'
import { refreshGovernanceSignal } from '@/lib/governance/signal'

/**
 * Keeps the signal bus warm autonomously (Law 2: "if data exists, it's already
 * been read"). Hourly, fans over active tenants; per tenant the engine recomputes
 * all five domain signals into Redis so the Command Center + cockpits open with
 * fresh vital signs even when no one has visited the page.
 */
export const signalRefreshCron = inngest.createFunction(
  { id: 'signal-refresh-cron', retries: 0, triggers: [{ cron: 'TZ=Africa/Johannesburg 0 * * * *' }] },
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
        tenants.map((t: any) => ({ name: 'adminos/signals.refresh' as const, data: { tenant_id: t.id } })),
      )
    })
    return { fanned: tenants.length }
  },
)

export const signalRefreshEngine = inngest.createFunction(
  { id: 'signal-refresh-engine', retries: 2, triggers: [{ event: 'adminos/signals.refresh' }] },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async ({ event, step }: any) => {
    const { tenant_id } = event.data as { tenant_id: string }

    await step.run('refresh-signals', async () => {
      // Best-effort per domain — one failing signal never blocks the others.
      const results = await Promise.allSettled([
        refreshMoneySignal(tenant_id),
        refreshOpsSignal(tenant_id),
        refreshSalesSignal(tenant_id),
        refreshPeopleSignal(tenant_id),
        refreshGovernanceSignal(tenant_id),
      ])
      const failed = results.filter(r => r.status === 'rejected').length
      return { refreshed: results.length - failed, failed }
    })

    return { tenant_id, status: 'refreshed' }
  },
)
