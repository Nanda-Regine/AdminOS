import { inngest } from '@/inngest/client'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { calculateValuation, saveValuationSnapshot } from '@/lib/intelligence/valuation'

// Runs weekly on Sunday at 3am — refreshes valuation snapshots for active Scale/Partner tenants
// Solo/Grow tenants get monthly snapshots to manage API costs
export const valuationSnapshotFunction = inngest.createFunction(
  { id: 'valuation-snapshot-weekly', retries: 1 },
  { cron: '0 3 * * 0' },
  async ({ step }) => {
    const today = new Date().toISOString().split('T')[0]

    // Get Scale+ tenants (valuation tracking is a Scale/Partner feature)
    const targets = await step.run('get-target-tenants', async () => {
      const { data } = await supabaseAdmin
        .from('tenants')
        .select('id, plan')
        .in('plan', ['scale', 'partner'])
        .eq('status', 'active')

      return data ?? []
    })

    let processed = 0
    let skipped   = 0
    const errors: string[] = []

    for (const tenant of targets) {
      // eslint-disable-next-line no-await-in-loop
      const result = await step.run(`valuation-${tenant.id}`, async () => {
        try {
          // Check if we already have a snapshot today
          const { data: existing } = await supabaseAdmin
            .from('valuation_snapshots')
            .select('id')
            .eq('tenant_id', tenant.id)
            .eq('snapshot_date', today)
            .maybeSingle()

          if (existing) return { status: 'skipped', reason: 'already_calculated' }

          const valuation = await calculateValuation(tenant.id)
          await saveValuationSnapshot(valuation)

          return { status: 'ok', value: valuation.estimatedValue }
        } catch (err) {
          return { status: 'error', error: String(err) }
        }
      })

      if (result.status === 'ok') processed++
      else if (result.status === 'skipped') skipped++
      else errors.push(`${tenant.id}: ${result.error}`)
    }

    return { date: today, processed, skipped, errors: errors.length, error_list: errors }
  }
)

// On-demand valuation event — fired when user views valuation page
export const onValuationRequested = inngest.createFunction(
  { id: 'valuation-on-demand', retries: 2, triggers: [{ event: 'adminos/valuation.calculate' }] },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async ({ event, step }: any) => {
    const { tenant_id } = event.data as { tenant_id: string }

    const valuation = await step.run('calculate', async () => {
      return await calculateValuation(tenant_id)
    })

    await step.run('save', async () => {
      await saveValuationSnapshot(valuation)
    })

    return { tenant_id, estimated_value: valuation.estimatedValue, exit_score: valuation.exitScore }
  }
)
