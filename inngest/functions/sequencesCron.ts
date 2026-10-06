import { inngest } from '@/inngest/client'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { sendWhatsAppMessage } from '@/lib/whatsapp/send'
import { phoneMayBeMarketed } from '@/lib/reach/audience'
import { withOptOutFooter, personalise } from '@/lib/reach/consent'

// Hourly: send each due sequence step. Session 20 (sixth sitting):
// - Sent with sendWhatsApp(), i.e. the PLATFORM number, after checking the
//   tenant had its own — now sends from the tenant's number, as the business.
// - POPIA s69: checks consent/customer status and STOP replies before every
//   step (an opt-out cancels the enrollment), and every message carries the
//   business name + opt-out line.

export const sequencesCronFunction = inngest.createFunction(
  { id: 'sequences-cron', retries: 0, triggers: [{ cron: '0 * * * *' }] },
  async ({ step }: any) => {
    const enrollments = await step.run('fetch-due-enrollments', async () => {
      const { data } = await supabaseAdmin
        .from('sequence_enrollments')
        .select('id, tenant_id, sequence_id, contact_identifier, current_step, next_step_at')
        .eq('status', 'active')
        .lte('next_step_at', new Date().toISOString())
        .limit(200)
      return data ?? []
    })

    if (!enrollments.length) return { processed: 0 }

    const sequenceIds = [...new Set(enrollments.map((e: { sequence_id: string }) => e.sequence_id))]
    const tenantIds   = [...new Set(enrollments.map((e: { tenant_id: string }) => e.tenant_id))]

    const [sequences, tenants] = await step.run('load-lookups', async () => {
      const [seqRes, tenantRes] = await Promise.all([
        supabaseAdmin.from('whatsapp_sequences').select('id, steps, tenant_id').is('deleted_at', null).in('id', sequenceIds),
        supabaseAdmin.from('tenants').select('id, name, meta_phone_number_id').in('id', tenantIds),
      ])
      return [seqRes.data ?? [], tenantRes.data ?? []]
    })

    const seqMap    = Object.fromEntries((sequences as Array<{ id: string; steps: unknown; tenant_id: string }>).map((s) => [s.id, s]))
    const tenantMap = Object.fromEntries((tenants as Array<{ id: string; name?: string; meta_phone_number_id?: string }>).map((t) => [t.id, t]))

    let processed = 0
    let failed    = 0

    for (const enrollment of enrollments) {
      await step.run(`process-enrollment-${enrollment.id}`, async () => {
        const seq    = seqMap[enrollment.sequence_id] as { steps: Array<{ delay_hours: number; message: string }> } | undefined
        const tenant = tenantMap[enrollment.tenant_id] as { name?: string; meta_phone_number_id?: string } | undefined

        if (!seq || !tenant?.meta_phone_number_id) {
          await supabaseAdmin
            .from('sequence_enrollments')
            .update({ status: 'cancelled' })
            .eq('id', enrollment.id)
          return
        }

        const steps     = seq.steps
        const stepIndex = enrollment.current_step

        if (stepIndex >= steps.length) {
          await supabaseAdmin
            .from('sequence_enrollments')
            .update({ status: 'completed' })
            .eq('id', enrollment.id)
          processed++
          return
        }

        const step_item = steps[stepIndex]

        if (!(await phoneMayBeMarketed(enrollment.tenant_id, enrollment.contact_identifier))) {
          await supabaseAdmin
            .from('sequence_enrollments')
            .update({ status: 'cancelled' })
            .eq('id', enrollment.id)
          return
        }

        try {
          await sendWhatsAppMessage(tenant.meta_phone_number_id, enrollment.contact_identifier,
            withOptOutFooter(personalise(step_item.message, null), tenant.name))
        } catch (err) {
          console.error(`[sequences-cron] send failed for enrollment ${enrollment.id}:`, err)
          failed++
          const retryAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
          await supabaseAdmin
            .from('sequence_enrollments')
            .update({ next_step_at: retryAt })
            .eq('id', enrollment.id)
          return
        }

        const nextIndex = stepIndex + 1
        const isDone    = nextIndex >= steps.length

        if (isDone) {
          await supabaseAdmin
            .from('sequence_enrollments')
            .update({ current_step: nextIndex, status: 'completed' })
            .eq('id', enrollment.id)
        } else {
          const nextDelay  = steps[nextIndex].delay_hours ?? 24
          const nextStepAt = new Date(Date.now() + nextDelay * 60 * 60 * 1000).toISOString()
          await supabaseAdmin
            .from('sequence_enrollments')
            .update({ current_step: nextIndex, next_step_at: nextStepAt })
            .eq('id', enrollment.id)
        }
        processed++
      })
    }

    return { processed, failed }
  }
)
