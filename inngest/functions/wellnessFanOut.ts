import { inngest } from '@/inngest/client'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { sendWhatsAppTemplate } from '@/lib/whatsapp/send'
import { WHATSAPP_TEMPLATES } from '@/lib/whatsapp/templates'
import { writeAuditLog } from '@/lib/security/audit'

export const wellnessFanOut = inngest.createFunction(
  { id: 'wellness-fan-out', retries: 1, triggers: [{ event: 'adminos/wellness.checkin.due' }] },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async ({ event, step }: any) => {
    const { tenant_id } = event.data as { tenant_id: string }

    const staff = await step.run('load-staff', async () => {
      const { data } = await supabaseAdmin
        .from('staff')
        .select('id, full_name, phone, language')
        .eq('tenant_id', tenant_id)
        .eq('status', 'active')
        .not('phone', 'is', null)
      return data ?? []
    })

    const results = await step.run('send-checkins', async () => {
      const phoneNumberId = process.env.META_PHONE_NUMBER_ID!

      const outcomes = await Promise.allSettled(
        staff.map((member: { id: string; full_name?: string; phone: string; language?: string }) =>
          sendWhatsAppTemplate(
            phoneNumberId,
            member.phone,
            WHATSAPP_TEMPLATES.WELLNESS_CHECKIN,
            (member.language ?? 'en') + '_ZA',
            [{ type: 'body', parameters: [{ type: 'text', text: member.full_name ?? 'there' }] }]
          )
        )
      )

      const sent = outcomes.filter((r) => r.status === 'fulfilled').length
      const failed = outcomes.filter((r) => r.status === 'rejected').length
      return { sent, failed }
    })

    await writeAuditLog({
      tenantId: tenant_id,
      actor: 'care',
      action: 'wellness_checkins_sent',
      metadata: { staff_count: staff.length, ...results },
    })

    return { tenant_id, staff_count: staff.length, ...results, status: 'sent' }
  }
)
