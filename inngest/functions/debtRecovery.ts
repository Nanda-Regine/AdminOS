import { inngest } from '@/inngest/client'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { sendWhatsAppMessage, sendWhatsAppTemplate } from '@/lib/whatsapp/send'
import { WHATSAPP_TEMPLATES } from '@/lib/whatsapp/templates'
import { writeAuditLog } from '@/lib/security/audit'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

const TIER_DELAYS_DAYS = [0, 2, 4, 7, 16] // days until next tier check

export const debtRecoveryEngine = inngest.createFunction(
  { id: 'debt-recovery-engine', retries: 3, concurrency: { limit: 10 }, triggers: [{ event: 'adminos/invoice.overdue' }] },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async ({ event, step }: any) => {
    const { invoice_id, tenant_id } = event.data as { invoice_id: string; tenant_id: string; amount: number; days_overdue: number }

    const context = await step.run('load-context', async () => {
      const [invoiceRes, tenantRes] = await Promise.all([
        supabaseAdmin
          .from('invoices')
          .select('contact_name, contact_phone, contact_email, amount, days_overdue, reference, recovery_tier')
          .eq('id', invoice_id)
          .single(),
        supabaseAdmin
          .from('tenants')
          .select('name, settings, system_prompt_cache, language_primary')
          .eq('id', tenant_id)
          .single(),
      ])

      const phoneRes = await supabaseAdmin
        .from('tenants')
        .select('waba_id')
        .eq('id', tenant_id)
        .single()

      return {
        invoice: invoiceRes.data,
        tenant: tenantRes.data,
        phoneNumberId: process.env.META_PHONE_NUMBER_ID!,
        wabaId: phoneRes.data?.waba_id,
      }
    })

    if (!context.invoice) return { status: 'invoice_not_found' }

    const tier = await step.run('calculate-tier', async () => {
      const days = context.invoice!.days_overdue ?? 0
      if (days <= 2) return 1
      if (days <= 6) return 2
      if (days <= 13) return 3
      if (days <= 29) return 4
      return 5
    })

    if (tier > 5) {
      await step.run('flag-manual-review', async () => {
        await writeAuditLog({
          tenantId: tenant_id,
          actor: 'chase',
          action: 'debt_recovery_escalated_manual',
          resourceType: 'invoice',
          resourceId: invoice_id,
          metadata: { tier, invoice_id },
        })
      })
      return { status: 'escalated_to_manual', tier }
    }

    const message = await step.run('generate-message', async () => {
      const inv = context.invoice!
      const tenantName = context.tenant?.name ?? 'our business'
      const lang = context.tenant?.language_primary ?? 'en'

      const toneMap: Record<number, string> = {
        1: 'friendly and gentle reminder',
        2: 'polite follow-up',
        3: 'firm professional notice',
        4: 'serious final notice',
        5: 'formal letter of demand',
      }

      const response = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        messages: [{
          role: 'user',
          content: `Write a ${toneMap[tier]} WhatsApp message (under 250 chars) in ${lang} for:
Business: ${tenantName}
Contact: ${inv.contact_name ?? 'valued client'}
Amount owed: R${inv.amount}
Days overdue: ${inv.days_overdue}
Invoice ref: ${inv.reference ?? invoice_id.slice(0, 8)}
Reply ONLY with the message text.`,
        }],
      })

      return response.content[0].type === 'text' ? response.content[0].text : ''
    })

    const templateMap: Record<number, string> = {
      1: WHATSAPP_TEMPLATES.DEBT_TIER_1_FRIENDLY,
      2: WHATSAPP_TEMPLATES.DEBT_TIER_2_FOLLOWUP,
      3: WHATSAPP_TEMPLATES.DEBT_TIER_3_FIRM,
      4: WHATSAPP_TEMPLATES.DEBT_TIER_4_FINAL,
      5: WHATSAPP_TEMPLATES.DEBT_TIER_5_DEMAND,
    }

    await step.run('send-message', async () => {
      const phone = context.invoice!.contact_phone
      if (!phone) return { skipped: true }

      if (tier <= 4) {
        // Within 24h window: send free-form; outside: use template
        try {
          await sendWhatsAppMessage(context.phoneNumberId, phone, message)
        } catch {
          // Fall back to template if free-form rejected
          await sendWhatsAppTemplate(
            context.phoneNumberId,
            phone,
            templateMap[tier],
            'en_ZA',
            [{ type: 'body', parameters: [{ type: 'text', text: message }] }]
          )
        }
      } else {
        await sendWhatsAppTemplate(
          context.phoneNumberId,
          phone,
          templateMap[5],
          'en_ZA',
          [{ type: 'body', parameters: [{ type: 'text', text: message }] }]
        )
      }
    })

    await step.run('update-invoice', async () => {
      await supabaseAdmin.from('invoices').update({
        last_reminder_sent_at: new Date().toISOString(),
        recovery_tier: tier,
      }).eq('id', invoice_id)
    })

    await step.run('audit-log', async () => {
      await writeAuditLog({
        tenantId: tenant_id,
        actor: 'chase',
        action: 'debt_recovery_sent',
        resourceType: 'invoice',
        resourceId: invoice_id,
        metadata: { tier, message_preview: message.substring(0, 100) },
      })
    })

    await step.run('mark-queue-complete', async () => {
      await supabaseAdmin
        .from('workflow_queue')
        .update({ status: 'complete', completed_at: new Date().toISOString() })
        .eq('payload->>invoice_id', invoice_id)
        .eq('status', 'processing')
    })

    if (tier < 5) {
      const nextCheckMs = TIER_DELAYS_DAYS[tier] * 24 * 60 * 60 * 1000
      await step.sleepUntil(
        `next-escalation-tier-${tier + 1}`,
        new Date(Date.now() + nextCheckMs)
      )
    }

    return { status: 'sent', tier, invoice_id }
  }
)
