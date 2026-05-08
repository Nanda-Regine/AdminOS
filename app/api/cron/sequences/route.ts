import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { sendWhatsApp } from '@/lib/whatsapp/send'

export const runtime = 'nodejs'

// Vercel Cron: runs every 15 minutes
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const now = new Date().toISOString()

  // Fetch all due enrollments
  const { data: enrollments, error } = await supabaseAdmin
    .from('sequence_enrollments')
    .select('id, tenant_id, sequence_id, contact_identifier, current_step, next_step_at')
    .eq('status', 'active')
    .lte('next_step_at', now)
    .limit(200)

  if (error) {
    console.error('[cron/sequences] fetch error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!enrollments?.length) {
    return NextResponse.json({ processed: 0 })
  }

  // Pre-load sequences needed
  const sequenceIds = [...new Set(enrollments.map(e => e.sequence_id))]
  const { data: sequences } = await supabaseAdmin
    .from('whatsapp_sequences')
    .select('id, steps, tenant_id')
    .in('id', sequenceIds)

  const seqMap = Object.fromEntries((sequences ?? []).map(s => [s.id, s]))

  // Pre-load tenant phone number IDs
  const tenantIds = [...new Set(enrollments.map(e => e.tenant_id))]
  const { data: tenants } = await supabaseAdmin
    .from('tenants')
    .select('id, meta_phone_number_id')
    .in('id', tenantIds)

  const tenantMap = Object.fromEntries((tenants ?? []).map(t => [t.id, t]))

  let processed = 0
  let failed    = 0

  for (const enrollment of enrollments) {
    const seq    = seqMap[enrollment.sequence_id]
    const tenant = tenantMap[enrollment.tenant_id]

    if (!seq || !tenant?.meta_phone_number_id) {
      await supabaseAdmin
        .from('sequence_enrollments')
        .update({ status: 'cancelled' })
        .eq('id', enrollment.id)
        .then(() => {}, () => {})
      continue
    }

    const steps = seq.steps as Array<{ name: string; delay_hours: number; message: string }>
    const stepIndex = enrollment.current_step

    if (stepIndex >= steps.length) {
      // All steps done — mark complete
      await supabaseAdmin
        .from('sequence_enrollments')
        .update({ status: 'completed' })
        .eq('id', enrollment.id)
        .then(() => {}, () => {})
      processed++
      continue
    }

    const step = steps[stepIndex]

    try {
      await sendWhatsApp({ to: enrollment.contact_identifier, message: step.message })
    } catch (err) {
      console.error(`[cron/sequences] send failed for enrollment ${enrollment.id}:`, err)
      failed++
      // Back off 2 hours on failure so the next cron run retries without hammering
      const retryAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
      await supabaseAdmin
        .from('sequence_enrollments')
        .update({ next_step_at: retryAt })
        .eq('id', enrollment.id)
        .then(() => {}, () => {})
      continue
    }

    const nextStepIndex = stepIndex + 1
    const isDone        = nextStepIndex >= steps.length

    if (isDone) {
      await supabaseAdmin
        .from('sequence_enrollments')
        .update({ current_step: nextStepIndex, status: 'completed' })
        .eq('id', enrollment.id)
        .then(() => {}, () => {})
    } else {
      const nextDelay   = steps[nextStepIndex].delay_hours ?? 24
      const nextStepAt  = new Date(Date.now() + nextDelay * 60 * 60 * 1000).toISOString()
      await supabaseAdmin
        .from('sequence_enrollments')
        .update({ current_step: nextStepIndex, next_step_at: nextStepAt })
        .eq('id', enrollment.id)
        .then(() => {}, () => {})
    }

    processed++
  }

  return NextResponse.json({ processed, failed })
}
