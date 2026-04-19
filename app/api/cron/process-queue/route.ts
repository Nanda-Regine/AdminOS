import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { inngest } from '@/inngest/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: jobs } = await supabaseAdmin
    .from('workflow_queue')
    .select('*')
    .eq('status', 'pending')
    .lte('scheduled_for', new Date().toISOString())
    .limit(50)

  if (!jobs || jobs.length === 0) {
    return NextResponse.json({ processed: 0 })
  }

  const results = await Promise.allSettled(
    jobs.map(async (job) => {
      await supabaseAdmin
        .from('workflow_queue')
        .update({ status: 'running', started_at: new Date().toISOString() })
        .eq('id', job.id)

      const eventMap: Record<string, string> = {
        debt_recovery: 'adminos/invoice.overdue',
        wellness_checkin: 'adminos/wellness.checkin.due',
        daily_brief: 'adminos/brief.generate',
        doc_pipeline: 'adminos/document.uploaded',
        onboarding: 'adminos/subscription.activated',
        trial_nudge: 'adminos/trial.expiring',
      }

      const eventName = eventMap[job.workflow_type]
      if (!eventName) throw new Error(`Unknown workflow_type: ${job.workflow_type}`)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await inngest.send({ name: eventName as any, data: job.payload ?? {} })

      await supabaseAdmin
        .from('workflow_queue')
        .update({ status: 'complete', completed_at: new Date().toISOString() })
        .eq('id', job.id)
    })
  )

  const failed = results.filter((r) => r.status === 'rejected')
  for (let i = 0; i < failed.length; i++) {
    const job = jobs[i]
    const reason = failed[i].status === 'rejected' ? String((failed[i] as PromiseRejectedResult).reason) : ''
    await supabaseAdmin
      .from('workflow_queue')
      .update({ status: 'failed', error_message: reason })
      .eq('id', job.id)
  }

  return NextResponse.json({ processed: jobs.length, failed: failed.length })
}
