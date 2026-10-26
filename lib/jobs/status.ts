import { supabaseAdmin } from '@/lib/supabase/admin'
import { JOBS, jobState, type JobState } from '@/lib/jobs/registry'

export interface JobHealth {
  id: string
  label: string
  state: JobState
  lastOkAt: string | null
  lastError: string | null
}

/** Every heartbeat-wrapped job and whether it is running on time. Unreadable → empty (show nothing, claim nothing). */
export async function getJobHealth(now: Date = new Date()): Promise<JobHealth[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('job_heartbeats')
      .select('job_id, last_ok_at, last_error_at, last_error')
    if (error) throw error
    const byId = new Map((data ?? []).map((r) => [r.job_id as string, r]))
    return JOBS.map((j) => {
      const hb = byId.get(j.id)
      return {
        id: j.id,
        label: j.label,
        state: jobState(hb ? { last_ok_at: hb.last_ok_at as string | null, last_error_at: hb.last_error_at as string | null } : null, j.maxGapHours, now),
        lastOkAt: (hb?.last_ok_at as string | null) ?? null,
        lastError: (hb?.last_error as string | null) ?? null,
      }
    })
  } catch (e) {
    console.error('[jobs] health unreadable', e instanceof Error ? e.message : e)
    return []
  }
}
