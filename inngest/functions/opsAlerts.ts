import { inngest } from '@/inngest/client'
import { heartbeat } from '@/lib/jobs/heartbeat'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { fetchAll } from '@/lib/supabase/fetchAll'
import { buildOpsIntel } from '@/lib/ops/signal'
import { draftReorder } from '@/lib/ops/reorderDraft'
import { notifyTenant } from '@/lib/notifications/notify'
import { getTenantAutonomy } from '@/lib/autonomy/config'
import { resolveTier, tierAllowsWhatsapp } from '@/lib/autonomy/tiers'
import { sastDate } from '@/lib/time/sast'

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
  heartbeat('low-stock-alert-cron', async ({ step }: any) => {
    const tenants = await step.run('fetch-tenants', async () => {
      return fetchAll<{ id: string }>((from, to) =>
        supabaseAdmin.from('tenants').select('id').eq('active', true).order('id').range(from, to))
    })
    if (!tenants.length) return { fanned: 0 }

    await step.run('send-events', async () => {
      await inngest.send(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tenants.map((t: any) => ({ name: 'adminos/ops.lowstock-check' as const, data: { tenant_id: t.id } })),
      )
    })
    return { fanned: tenants.length }
  }),
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
      const today = sastDate()
      // A ready-to-send supplier order, not just "time to reorder": the owner copies it, adjusts it and sends it.
      const { data: t } = await supabaseAdmin.from('tenants').select('name').eq('id', tenant_id).maybeSingle()
      const draft = await draftReorder(tenant_id, (t?.name as string | undefined) ?? 'our business')
      await notifyTenant(tenant_id, {
        type: 'ops.low_stock',
        title: `${lowStockItems.length} product${lowStockItems.length === 1 ? '' : 's'} at or below reorder level`,
        body: `Time to reorder: ${top}${lowStockItems.length > 5 ? ` and ${lowStockItems.length - 5} more` : ''}.${draft.text ? `

Draft order to send your supplier (check the quantities first):
${draft.text}` : ''}`,
        actionUrl: '/dashboard/inventory',
        dedupeKey: `low-stock-${tenant_id}-${today}`,
        dedupeHours: 20,
        whatsapp: tierAllowsWhatsapp(tier),
      })
    })

    return { tenant_id, status: 'notified', count: lowStockItems.length }
  },
)
