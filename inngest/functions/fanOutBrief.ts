import { inngest } from '@/inngest/client'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const fanOutBriefCron = inngest.createFunction(
  { id: 'fan-out-brief-cron', retries: 0 },
  { cron: '0 3 * * 1-5' }, // weekdays 5am SAST
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
          name: 'adminos/brief.generate' as const,
          data: { tenant_id: t.id },
        }))
      )
    })

    return { fanned: tenants.length }
  }
)
