import { inngest } from '@/inngest/client'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const fanOutWellnessCron = inngest.createFunction(
  { id: 'fan-out-wellness-cron', retries: 0 },
  { cron: '0 7 * * 1' }, // Monday 9am SAST
  async ({ step }) => {
    const tenants = await step.run('fetch-tenants', async () => {
      const { data } = await supabaseAdmin
        .from('tenants')
        .select('id')
        .eq('active', true)
      return data ?? []
    })

    if (!tenants.length) return { fanned: 0 }

    await step.run('send-events', async () => {
      await inngest.send(
        tenants.map((t) => ({
          name: 'adminos/wellness.checkin.due' as const,
          data: { tenant_id: t.id },
        }))
      )
    })

    return { fanned: tenants.length }
  }
)
