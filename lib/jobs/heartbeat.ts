import { supabaseAdmin } from '@/lib/supabase/admin'

/**
 * Wrap an Inngest cron handler so each finished run leaves a heartbeat
 * (lib/jobs/registry.ts says how long each job may stay silent).
 *
 *   inngest.createFunction({ id: 'x', ... }, heartbeat('x', async ({ step }) => { ... }))
 *
 * Success is recorded as its own memoised step, so a retry never counts twice.
 * A failure is recorded and re-thrown, so Inngest's own retry behaviour is
 * untouched. Recording never throws into the job: a heartbeat problem must not
 * fail the work it is watching.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function heartbeat<T>(jobId: string, handler: (ctx: any) => Promise<T>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return async (ctx: any): Promise<T> => {
    let result: T
    try {
      result = await handler(ctx)
    } catch (err) {
      await recordFailure(jobId, err)
      throw err
    }
    await ctx.step.run('job-heartbeat', () => recordSuccess(jobId))
    return result
  }
}

async function recordSuccess(jobId: string): Promise<void> {
  try {
    const now = new Date().toISOString()
    const { data } = await supabaseAdmin.from('job_heartbeats').select('ok_count').eq('job_id', jobId).maybeSingle()
    const { error } = await supabaseAdmin.from('job_heartbeats').upsert({
      job_id: jobId, last_ok_at: now, ok_count: Number(data?.ok_count ?? 0) + 1, updated_at: now,
    }, { onConflict: 'job_id' })
    if (error) console.error('[heartbeat] not recorded', jobId, error.message)
  } catch (e) {
    console.error('[heartbeat] not recorded', jobId, e instanceof Error ? e.message : e)
  }
}

async function recordFailure(jobId: string, err: unknown): Promise<void> {
  try {
    const now = new Date().toISOString()
    const message = (err instanceof Error ? err.message : String(err)).slice(0, 300)
    const { data } = await supabaseAdmin.from('job_heartbeats').select('ok_count').eq('job_id', jobId).maybeSingle()
    await supabaseAdmin.from('job_heartbeats').upsert({
      job_id: jobId, last_error_at: now, last_error: message, ok_count: Number(data?.ok_count ?? 0), updated_at: now,
    }, { onConflict: 'job_id' })
  } catch (e) {
    console.error('[heartbeat] failure not recorded', jobId, e instanceof Error ? e.message : e)
  }
}
