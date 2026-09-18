import { inngest } from '@/inngest/client'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { buildOpsIntel } from '@/lib/ops/signal'
import { notifyTenant } from '@/lib/notifications/notify'
import { getTenantAutonomy } from '@/lib/autonomy/config'
import { resolveTier, tierAllowsWhatsapp } from '@/lib/autonomy/tiers'

/**
 * Autonomy: ops/low_stock_reorder_alert (default A — "an alert, not an
 * order, is safe" per lib/autonomy/tiers.ts). This never places an order —
 * it only flags products at/below their reorder level so the owner can.
 * Daily, fans over active tenants; one deduped notification per tenant per
 * day even if the low-stock list changes hour to hour.
 */
export const lowStockAlertCron = inngest.createFunction(
  { id: 'low-stock-alert-cron', retries: 0, triggers: [{ cron: 'TZ=Africa/Johannesburg 30 6 * * *' }] },
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
        tenants.map((t: any) => ({ name: 'adminos/ops.lowstock-check' as const, data: { tenant_id: t.id } })),
      )
    })
    return { fanned: tenants.length }
  },
)

export const lowStockAlertEngine = inngest.createFunction(
  { id: 'low-stock-alert-engine', retries: 2, triggers: [{ event: 'adminos/ops.lowstock-check' }] },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async ({ event, step }: any) => {
    const { tenant_id } = event.data as { tenant_id: string }

    const lowStockItems = await step.run('compute-low-stock', async () => {
      const intel = await buildOpsIntel(tenant_id)
      return intel.lowStockItems
    })
    if (!lowStockItems.length) return { tenant_id, status: 'none' }

    await step.run('notify', async () => {
      const tier = resolveTier(await getTenantAutonomy(tenant_id), 'ops', 'low_stock_reorder_alert')
      const top = lowStockItems.slice(0, 5).map((i: { name: string; onHand: number; reorderAt: number }) => `${i.name} (${i.onHand}/${i.reorderAt})`).join(', ')
      const today = new Date().toISOString().slice(0, 10)
      await notifyTenant(tenant_id, {
        type: 'ops.low_stock',
        title: `${lowStockItems.length} product${lowStockItems.length === 1 ? '' : 's'} at or below reorder level`,
        body: `Time to reorder: ${top}${lowStockItems.length > 5 ? ` and ${lowStockItems.length - 5} more` : ''}.`,
        actionUrl: '/dashboard/inventory',
        dedupeKey: `low-stock-${tenant_id}-${today}`,
        dedupeHours: 20,
        whatsapp: tierAllowsWhatsapp(tier),
      })
    })

    return { tenant_id, status: 'notified', count: lowStockItems.length }
  },
)
