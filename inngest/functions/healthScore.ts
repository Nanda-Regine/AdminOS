import { inngest } from '@/inngest/client'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { calculateHealthScore, saveHealthSnapshot } from '@/lib/intelligence/healthScore'

export const healthScoreFunction = inngest.createFunction(
  { id: 'health-score-calculate', retries: 2, triggers: [{ event: 'adminos/health.score.calculate' }] },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async ({ event, step }: any) => {
    const { tenant_id } = event.data as { tenant_id: string }

    const result = await step.run('calculate-score', async () => {
      return calculateHealthScore(tenant_id)
    })

    await step.run('save-snapshot', async () => {
      await saveHealthSnapshot(tenant_id, result)
    })

    return { tenant_id, overall: result.overall }
  }
)
