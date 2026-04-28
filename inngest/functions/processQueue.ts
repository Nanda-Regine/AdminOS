import { inngest } from '@/inngest/client'
import { supabaseAdmin } from '@/lib/supabase/admin'

const EVENT_MAP: Record<string, string> = {
  debt_recovery:     'adminos/invoice.overdue',
  wellness_checkin:  'adminos/wellness.checkin.due',
  daily_brief:       'adminos/brief.generate',
  doc_pipeline:      'adminos/document.uploaded',
  onboarding:        'adminos/subscription.activated',
  trial_nudge:       'adminos/trial.expiring',
}

export const processQueueCron = inngest.createFunction(
  { id: 'process-queue-cron', retries: 0 },
  { cron: '*/5 * * * *' },
  async ({ step }) => {
    const jobs = await step.run('fetch-pending-jobs', async () => {
      const { data } = await supabaseAdmin
        .from('workflow_queue')
        .select('*')
        .eq('status', 'pending')
        .lte('scheduled_for', new Date().toISOString())
        .limit(50)
      return data ?? []
    })

    if (jobs.length === 0) return { processed: 0 }

    const results = await step.run('fire-events', async () => {
      const settled = await Promise.allSettled(
        jobs.map(async (job: { id: string; workflow_type: string; payload: Record<string, unknown>; tenant_id: string }) => {
          await supabaseAdmin
            .from('workflow_queue')
            .update({ status: 'running', started_at: new Date().toISOString() })
            .eq('id', job.id)

          const eventName = EVENT_MAP[job.workflow_type]
          if (!eventName) throw new Error(`Unknown workflow_type: ${job.workflow_type}`)

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await inngest.send({ name: eventName as any, data: { ...(job.payload ?? {}), tenant_id: job.tenant_id } })

          await supabaseAdmin
            .from('workflow_queue')
            .update({ status: 'complete', completed_at: new Date().toISOString() })
            .eq('id', job.id)
        })
      )

      const failed = settled
        .map((r, i) => (r.status === 'rejected' ? { job: jobs[i], reason: String((r as PromiseRejectedResult).reason) } : null))
        .filter(Boolean)

      await Promise.all(
        failed.map((f) =>
          supabaseAdmin
            .from('workflow_queue')
            .update({ status: 'failed', error_message: f!.reason })
            .eq('id', f!.job.id)
        )
      )

      return { processed: jobs.length, failed: failed.length }
    })

    return results
  }
)
