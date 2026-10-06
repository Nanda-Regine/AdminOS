import { inngest } from '@/inngest/client'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { sendWhatsAppMessage } from '@/lib/whatsapp/send'
import { notifyTenant } from '@/lib/notifications/notify'
import { resolveAudience, type AudienceFilter } from '@/lib/reach/audience'
import { withOptOutFooter, personalise } from '@/lib/reach/consent'

const BATCH = 50

/**
 * Sends one Reach campaign (claimed as 'sending' by
 * app/api/reach/campaigns/[id]/send). Replaces a `void dispatchCampaign()`
 * inside the request — Vercel freezes the function once the 202 goes out, so
 * long lists stopped part-way and the campaign sat in 'sending' forever.
 *
 * The audience is resolved here, at send time, under POPIA s69
 * (lib/reach/consent.ts): consent or existing customer, never anyone who
 * replied STOP, and every message carries the business name + opt-out line.
 * Each batch is its own step, so a retry resumes rather than re-sending.
 */
export const reachCampaignSendFunction = inngest.createFunction(
  { id: 'reach-campaign-send', retries: 2, concurrency: { key: 'event.data.tenant_id', limit: 1 },
    triggers: [{ event: 'adminos/reach.campaign.send' }] },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async ({ event, step }: any) => {
    const { tenant_id, campaign_id } = event.data as { tenant_id: string; campaign_id: string }

    const plan = await step.run('audience', async () => {
      const [{ data: campaign }, { data: tenant }] = await Promise.all([
        supabaseAdmin.from('broadcast_campaigns').select('id, name, message_body, audience_filter, status')
          .eq('id', campaign_id).eq('tenant_id', tenant_id).is('deleted_at', null).maybeSingle(),
        supabaseAdmin.from('tenants').select('name, meta_phone_number_id').eq('id', tenant_id).maybeSingle(),
      ])
      if (!campaign || campaign.status !== 'sending' || !tenant?.meta_phone_number_id) return null
      const audience = await resolveAudience(tenant_id, (campaign.audience_filter ?? {}) as AudienceFilter)
      return {
        name: campaign.name as string,
        message: withOptOutFooter(campaign.message_body as string, tenant.name as string),
        phoneNumberId: tenant.meta_phone_number_id as string,
        recipients: audience.eligible.map((c) => ({ id: c.id, phone: c.phone, name: c.full_name })),
        heldBack: audience.optedOut + audience.noConsent,
      }
    })
    if (!plan) return { skipped: true }

    let sent = 0, failed = 0
    for (let i = 0; i < plan.recipients.length; i += BATCH) {
      const r = await step.run(`batch-${i / BATCH}`, async () => {
        let ok = 0, bad = 0
        const rows: Record<string, unknown>[] = []
        for (const c of plan.recipients.slice(i, i + BATCH) as Array<{ id: string; phone: string; name: string | null }>) {
          try {
            const { messageId } = await sendWhatsAppMessage(plan.phoneNumberId, c.phone, personalise(plan.message, c.name))
            rows.push({ campaign_id, tenant_id, contact_id: c.id, phone: c.phone, status: 'sent', message_id: messageId, sent_at: new Date().toISOString() })
            ok++
          } catch (err) {
            rows.push({ campaign_id, tenant_id, contact_id: c.id, phone: c.phone, status: 'failed',
              error_message: (err instanceof Error ? err.message : 'Send failed').slice(0, 500), failed_at: new Date().toISOString() })
            bad++
          }
        }
        if (rows.length) {
          const { error } = await supabaseAdmin.from('broadcast_recipients').insert(rows)
          if (error) console.error('[reach-campaign-send] recipient log failed', error)
        }
        return { ok, bad }
      })
      sent += r.ok
      failed += r.bad
    }

    await step.run('finish', async () => {
      await supabaseAdmin.from('broadcast_campaigns')
        .update({ status: 'sent', sent_at: new Date().toISOString(), sent_count: sent, failed_count: failed, updated_at: new Date().toISOString() })
        .eq('id', campaign_id).eq('tenant_id', tenant_id)
      await notifyTenant(tenant_id, {
        type: 'reach.campaign_sent',
        title: `Campaign sent: ${plan.name}`,
        body: `${sent} sent${failed ? `, ${failed} failed` : ''}${plan.heldBack ? `. ${plan.heldBack} held back (no consent or opted out, POPIA s69)` : ''}.`,
        actionUrl: '/dashboard/reach',
      })
    })

    return { sent, failed, heldBack: plan.heldBack }
  },
)
