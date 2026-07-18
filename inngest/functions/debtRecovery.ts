import { inngest } from '@/inngest/client'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { sendWhatsAppMessage } from '@/lib/whatsapp/send'
import { WHATSAPP_TEMPLATES } from '@/lib/whatsapp/templates'
import { checkRecoveryMessage } from '@/lib/debt/recoveryGuard'
import { daysOverdue } from '@/lib/debt/overdue'
import { writeAuditLog } from '@/lib/security/audit'
import { notifyTenant } from '@/lib/notifications/notify'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

// AdminOS never sends an escalation on the business's behalf. Tiers 1-3 are courteous,
// factual reminders and send automatically. Anything beyond tier 3 is a decision the
// business owner makes and sends themselves — we draft it, flag it, and stop.
// This boundary is what keeps AdminOS a tool rather than a debt collector acting for
// reward on another's behalf (Debt Collectors Act). Do not raise it without counsel.
const AUTO_SEND_MAX_TIER = 3

export const debtRecoveryEngine = inngest.createFunction(
  { id: 'debt-recovery-engine', retries: 3, concurrency: { limit: 10 }, triggers: [{ event: 'adminos/invoice.overdue' }] },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async ({ event, step }: any) => {
    const { invoice_id, tenant_id } = event.data as { invoice_id: string; tenant_id: string; amount: number; days_overdue: number }

    const context = await step.run('load-context', async () => {
      const [invoiceRes, tenantRes] = await Promise.all([
        supabaseAdmin
          .from('invoices')
          .select('contact_name, contact_phone, contact_email, amount, due_date, reference, recovery_tier')
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
      // Computed from due_date, not a stored column — see lib/debt/overdue.
      const days = daysOverdue(context.invoice!.due_date)
      if (days <= 2) return 1
      if (days <= 6) return 2
      if (days <= 13) return 3
      if (days <= 29) return 4
      if (days <= 60) return 5
      return 6  // manual review escalation
    })

    if (tier > AUTO_SEND_MAX_TIER) {
      await step.run('flag-owner-review', async () => {
        await writeAuditLog({
          tenantId: tenant_id,
          actor: 'chase',
          action: 'debt_recovery_awaiting_owner_review',
          resourceType: 'invoice',
          resourceId: invoice_id,
          metadata: { tier, invoice_id },
        })
        const { error } = await supabaseAdmin.from('invoices').update({
          recovery_tier: tier,
          recovery_status: 'awaiting_owner_review',
        }).eq('id', invoice_id)
        // Fail loudly: if we cannot record that this needs review, the owner will never
        // see it. Silence here means an escalation quietly disappears.
        if (error) throw new Error(`[DebtRecovery] could not flag invoice ${invoice_id} for owner review: ${error.message}`)
      })
      // Surface it to the owner (in-app bell + WhatsApp if a notify phone is set).
      // Best-effort — never blocks the escalation flag above.
      await step.run('notify-owner-review', async () => {
        const inv = context.invoice!
        await notifyTenant(tenant_id, {
          type: 'recovery.escalation',
          title: 'Invoice needs your review',
          body: `${inv.contact_name ?? 'A customer'}'s invoice (R${inv.amount}) is past the gentle-reminder stage. Decide how to proceed — AdminOS won't chase harder on its own.`,
          actionUrl: '/dashboard/invoices',
          dedupeKey: `recovery-review-${invoice_id}`,
          dedupeHours: 72,
          whatsapp: true,
        })
        return { notified: true }
      })
      return { status: 'awaiting_owner_review', tier }
    }

    const message = await step.run('generate-message', async () => {
      const inv = context.invoice!
      const days = daysOverdue(inv.due_date)
      const tenantName = context.tenant?.name ?? 'our business'
      const lang = context.tenant?.language_primary ?? 'en'

      // Only tiers 1-3 reach here — anything higher stopped at the owner-review gate above.
      const toneMap: Record<number, string> = {
        1: 'friendly and gentle reminder',
        2: 'polite follow-up',
        3: 'courteous but clear notice',
      }

      const response = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        messages: [{
          role: 'user',
          content: `Write a ${toneMap[tier]} WhatsApp message (under 250 chars) in ${lang} from a South African business to its own customer about an unpaid invoice.

Business: ${tenantName}
Contact: ${inv.contact_name ?? 'valued client'}
Amount owed: R${inv.amount}
Days overdue: ${days}
Invoice ref: ${inv.reference ?? invoice_id.slice(0, 8)}

You must NOT threaten or mention legal action, lawyers, courts, letters of demand, debt collectors, credit bureaus or blacklisting. Do not state or imply that any step has been taken, or set any deadline or consequence. Do not use shaming or pressure language. State only what is owed, how overdue it is, and how to get in touch. Offer to discuss a payment arrangement — the customer may be in real difficulty, or may dispute the invoice.

Reply ONLY with the message text.`,
        }],
      })

      return response.content[0].type === 'text' ? response.content[0].text : ''
    })

    const templateMap: Record<number, string> = {
      1: WHATSAPP_TEMPLATES.DEBT_TIER_1_FRIENDLY,
      2: WHATSAPP_TEMPLATES.DEBT_TIER_2_FOLLOWUP,
      3: WHATSAPP_TEMPLATES.DEBT_TIER_3_FIRM,
    }

    const sendResult = await step.run('send-message', async () => {
      const phone = context.invoice!.contact_phone
      if (!phone) return { sent: false as const, reason: 'no_phone' }

      // Belt and braces: the gate above already returned for tier > AUTO_SEND_MAX_TIER.
      // If a future edit moves that gate, this refuses rather than sends.
      if (tier > AUTO_SEND_MAX_TIER || !templateMap[tier]) {
        throw new Error(`[DebtRecovery] refusing to auto-send tier ${tier} — tiers above ${AUTO_SEND_MAX_TIER} require owner review`)
      }

      // Content guard: never put model-generated text on the wire if it slips a
      // legal reference or threat past the constrained prompt. A tripped guard
      // DEFERS — it does not fall back to sending unvetted text. The daily sweep
      // regenerates and retries next run.
      const guard = checkRecoveryMessage(message)
      if (!guard.safe) {
        await writeAuditLog({
          tenantId: tenant_id,
          actor: 'chase',
          action: 'debt_recovery_message_blocked',
          resourceType: 'invoice',
          resourceId: invoice_id,
          metadata: { tier, matched: guard.matched, preview: message.substring(0, 120) },
        })
        return { sent: false as const, reason: 'blocked_by_guard', matched: guard.matched }
      }

      // Meta permits free-form text only inside the 24h customer-service window.
      // Outside it an APPROVED template is required — that path needs the debt
      // templates submitted/approved in Meta Business Suite and their parameters
      // wired to real invoice fields (due date, pay link). That wiring happens in
      // the feature-verification phase; until then we defer rather than send a
      // malformed template (the old fallback stuffed the whole message into a
      // single param of a five-param template). Not marking the invoice sent
      // means the daily sweep retries it.
      try {
        await sendWhatsAppMessage(context.phoneNumberId, phone, message)
        return { sent: true as const }
      } catch (err) {
        await writeAuditLog({
          tenantId: tenant_id,
          actor: 'chase',
          action: 'debt_recovery_send_deferred',
          resourceType: 'invoice',
          resourceId: invoice_id,
          metadata: { tier, error: err instanceof Error ? err.message : String(err) },
        })
        return { sent: false as const, reason: 'send_failed_deferred' }
      }
    })

    await step.run('update-invoice', async () => {
      // Always record the tier we evaluated; only stamp last_reminder_sent_at
      // when a reminder actually went out, so a blocked/deferred run doesn't
      // masquerade as a delivered reminder.
      const patch: Record<string, unknown> = { recovery_tier: tier }
      if (sendResult.sent) patch.last_reminder_sent_at = new Date().toISOString()
      await supabaseAdmin.from('invoices').update(patch).eq('id', invoice_id)
    })

    if (sendResult.sent) {
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
    }

    await step.run('mark-queue-complete', async () => {
      await supabaseAdmin
        .from('workflow_queue')
        .update({ status: 'complete', completed_at: new Date().toISOString() })
        .eq('payload->>invoice_id', invoice_id)
        .eq('status', 'processing')
    })

    // Escalation is driven by fanOutDebtRecovery's daily sweep re-evaluating days
    // overdue — there is no need to hold a step open here waiting for the next tier.
    return {
      status: sendResult.sent ? 'sent' : 'not_sent',
      reason: sendResult.sent ? undefined : sendResult.reason,
      tier,
      invoice_id,
    }
  }
)
