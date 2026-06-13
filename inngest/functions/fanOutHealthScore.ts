import { inngest } from '@/inngest/client'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const fanOutHealthScoreCron = inngest.createFunction(
  { id: 'fan-out-health-score-cron', retries: 0, triggers: [{ cron: '0 2 * * 1' }] },
  async ({ step }: any) => {
    const tenants = await step.run('fetch-tenants', async () => {
      const { data } = await supabaseAdmin
        .from('tenants')
        .select('id')
        .not('plan', 'eq', 'cancelled')
      return data ?? []
    })

    if (!tenants.length) return { triggered: 0 }

    await step.run('send-events', async () => {
      await inngest.send(
        tenants.map((t: any) => ({
          name: 'adminos/health.score.calculate' as const,
          data: { tenant_id: t.id },
        }))
      )
    })

    return { triggered: tenants.length }
  }
)
