import { inngest } from '@/inngest/client'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { syncStatutoryCalendar } from '@/lib/compliance/sync'

// Keeps every tenant's statutory calendar 12 months deep. The old SQL seed ran
// once at signup and nothing extended it, so every calendar ran dry after a
// year. Also the repair path: `adminos/compliance.calendar.sync` re-plans one
// tenant (or all, with no tenant_id) — e.g. after the financial year end changes.
export const complianceCalendarRollFunction = inngest.createFunction(
  {
    id: 'compliance-calendar-roll',
    retries: 2,
    triggers: [{ cron: 'TZ=Africa/Johannesburg 0 5 1 * *' }, { event: 'adminos/compliance.calendar.sync' }],
  },
  async ({ step, event }: any) => {
    const only = event?.data?.tenant_id as string | undefined
    const tenants: { id: string }[] = await step.run('list-tenants', async () => {
      let q = supabaseAdmin.from('tenants').select('id').eq('active', true)
      if (only) q = q.eq('id', only)
      const { data, error } = await q
      if (error) throw error
      return data ?? []
    })
    const results: Record<string, unknown> = {}
    for (const t of tenants) {
      results[t.id] = await step.run(`sync-${t.id}`, () => syncStatutoryCalendar(t.id))
    }
    return { tenants: tenants.length, results }
  },
)
