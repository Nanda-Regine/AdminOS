import { inngest } from '@/inngest/client'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { sendWhatsAppMessage } from '@/lib/whatsapp/send'

// Runs weekly on Wednesday at 10am — sends WhatsApp reminders for unanswered NPS surveys
export const npsReminderFunction = inngest.createFunction(
  { id: 'nps-reminder-weekly', retries: 1, triggers: [{ cron: '0 10 * * 3' }] },
  async ({ step }: any) => {
    const weekAgo  = new Date(Date.now() - 7  * 86400000).toISOString()
    const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString()

    // Find unanswered surveys sent 3-30 days ago (reminder window)
    const { data: surveys } = await supabaseAdmin
      .from('nps_surveys')
      .select('id, tenant_id, survey_token, contact:contacts(name, phone)')
      .is('responded_at', null)
      .gte('sent_at', monthAgo)    // not older than 30 days
      .lte('sent_at', weekAgo)     // at least 7 days old
      .is('reminder_sent_at', null) // not already reminded

    if (!surveys || surveys.length === 0) {
      return { reminded: 0 }
    }

    let reminded = 0

    for (const survey of surveys) {
      const contact = survey.contact as { name?: string; phone?: string } | null
      if (!contact?.phone) continue

      const surveyUrl = `${process.env.NEXT_PUBLIC_APP_URL}/survey/${survey.survey_token}`

      await step.run(`remind-${survey.id}`, async () => {
        try {
          // Get tenant WhatsApp number
          const { data: tenant } = await supabaseAdmin
            .from('tenants')
            .select('settings')
            .eq('id', survey.tenant_id)
            .single()

          const settings         = tenant?.settings as Record<string, string> | null
          const phoneNumberId    = settings?.whatsapp_phone_number_id

          if (!phoneNumberId) return

          await sendWhatsAppMessage(
            phoneNumberId,
            contact.phone!,
            `Hi ${contact.name ?? 'there'} 👋 We noticed you haven't had a chance to share your feedback yet. It only takes 30 seconds and really helps us improve. Click here: ${surveyUrl}`,
          )

          await supabaseAdmin
            .from('nps_surveys')
            .update({ reminder_sent_at: new Date().toISOString() })
            .eq('id', survey.id)

          reminded++
        } catch {
          // Non-fatal — continue processing other surveys
        }
      })
    }

    return { reminded, total_eligible: surveys.length }
  }
)

// Trigger: NPS survey created — send immediately
export const onNPSSurveySent = inngest.createFunction(
  { id: 'nps-survey-send', retries: 2, triggers: [{ event: 'adminos/nps.survey.created' }] },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async ({ event, step }: any) => {
    const { tenant_id, survey_token, contact_phone, contact_name, survey_url } = event.data as {
      tenant_id: string
      survey_token: string
      contact_phone: string
      contact_name: string
      survey_url: string
    }

    await step.run('send-whatsapp', async () => {
      const { data: tenant } = await supabaseAdmin
        .from('tenants')
        .select('name, settings')
        .eq('id', tenant_id)
        .single()

      const settings      = tenant?.settings as Record<string, string> | null
      const phoneNumberId = settings?.whatsapp_phone_number_id

      if (!phoneNumberId) return

      await sendWhatsAppMessage(
        phoneNumberId,
        contact_phone,
        `Hi ${contact_name || 'there'}! ${tenant?.name ?? "We'd"} love to know how we're doing. How likely are you to recommend us? (0–10): ${survey_url}\n\nTakes 30 seconds. Thank you!`,
      )
    })

    return { tenant_id, survey_token }
  }
)
