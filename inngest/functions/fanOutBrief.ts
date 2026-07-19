import { inngest } from '@/inngest/client'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const fanOutBriefCron = inngest.createFunction(
  { id: 'fan-out-brief-cron', retries: 0, triggers: [{ cron: '0 3 * * 1-5' }] },
  async ({ step }: any) => {
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
        tenants.map((t: any) => ({
          name: 'adminos/brief.generate' as const,
          data: { tenant_id: t.id },
        }))
      )
    })

    // Warm every domain signal at the same 05:00 fan-out, so the morning brief
    // and the cockpit vital-signs are computed together off one wake-up rather
    // than waiting for the next hourly signal-refresh tick. Handled by the
    // existing signal-refresh engine (best-effort, retries) — decoupled from the
    // brief so a slow signal never delays the brief.
    await step.run('refresh-signals', async () => {
      await inngest.send(
        tenants.map((t: any) => ({
          name: 'adminos/signals.refresh' as const,
          data: { tenant_id: t.id },
        }))
      )
    })

    return { fanned: tenants.length }
  }
)
