import { inngest } from '@/inngest/client'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { sendWhatsAppTemplate } from '@/lib/whatsapp/send'
import { WHATSAPP_TEMPLATES } from '@/lib/whatsapp/templates'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY!)

export const onboardingSequence = inngest.createFunction(
  { id: 'onboarding-sequence', retries: 2, triggers: [{ event: 'adminos/subscription.activated' }] },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async ({ event, step }: any) => {
    const { tenant_id } = event.data as { tenant_id: string }

    const tenant = await step.run('load-tenant', async () => {
      const { data } = await supabaseAdmin
        .from('tenants')
        .select('name, settings')
        .eq('id', tenant_id)
        .single()
      return data
    })

    const ownerPhone = (tenant?.settings as Record<string, string>)?.owner_phone
    const ownerEmail = (tenant?.settings as Record<string, string>)?.owner_email
    const ownerName  = (tenant?.settings as Record<string, string>)?.owner_name ?? 'there'
    const businessName = tenant?.name ?? 'your business'

    // Immediate: Welcome WhatsApp
    if (ownerPhone) {
      await step.run('send-welcome-whatsapp', async () => {
        await sendWhatsAppTemplate(
          process.env.META_PHONE_NUMBER_ID!,
          ownerPhone,
          WHATSAPP_TEMPLATES.ONBOARDING_WELCOME,
          'en_ZA',
          [{ type: 'body', parameters: [{ type: 'text', text: ownerName }] }]
        )
      })
    }

    // Day 1: Setup guide email
    await step.sleepUntil('day-1-setup-email', new Date(Date.now() + 24 * 60 * 60 * 1000))
    if (ownerEmail) {
      await step.run('send-setup-guide', async () => {
        await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL!,
          to: ownerEmail,
          subject: `Your ${businessName} AdminOS is ready — let's set it up`,
          html: `<h2>Welcome to AdminOS, ${ownerName}!</h2><p>Your AI business operating system is live. Here's how to get started in 5 minutes...</p><p><a href="https://adminos.co.za/dashboard">Open your dashboard →</a></p>`,
        })
      })
    }

    // Day 3: First brief walkthrough
    await step.sleepUntil('day-3-brief-guide', new Date(Date.now() + 3 * 24 * 60 * 60 * 1000))
    if (ownerEmail) {
      await step.run('send-brief-guide', async () => {
        await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL!,
          to: ownerEmail,
          subject: `Your first AI morning brief is waiting`,
          html: `<h2>Good morning from AdminOS</h2><p>Your Insight agent has been preparing your first business brief. Check your dashboard to see what's waiting...</p><p><a href="https://adminos.co.za/dashboard">View your brief →</a></p>`,
        })
      })
    }

    // Day 7: Check-in
    await step.sleepUntil('day-7-checkin', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))
    if (ownerEmail) {
      await step.run('send-day7-checkin', async () => {
        await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL!,
          to: ownerEmail,
          subject: `How is AdminOS working for ${businessName}?`,
          html: `<h2>One week in — how are we doing?</h2><p>We'd love to hear what's working and what you'd like to see. Reply to this email or <a href="mailto:support@adminos.co.za">reach our team</a>.</p>`,
        })
      })
    }

    return { tenant_id, status: 'sequence_complete' }
  }
)
