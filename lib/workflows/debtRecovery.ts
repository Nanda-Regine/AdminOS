import { supabaseAdmin } from '@/lib/supabase/admin'
import { draftRecoveryMessage } from '@/lib/ai/callClaude'
import { sendWhatsApp } from '@/lib/whatsapp/send'
import { writeAuditLog } from '@/lib/security/audit'
import { Resend } from 'resend'
import { Invoice } from '@/types/database'

const resend = new Resend(process.env.RESEND_API_KEY!)

const ESCALATION_TIERS: Record<number, {
  days: number
  tone: string
  channel: string[]
}> = {
  1: { days: 1,  tone: 'friendly_reminder',    channel: ['whatsapp'] },
  2: { days: 3,  tone: 'gentle_follow_up',     channel: ['whatsapp', 'email'] },
  3: { days: 7,  tone: 'firm_professional',    channel: ['whatsapp', 'email'] },
  4: { days: 14, tone: 'serious_final_notice', channel: ['whatsapp', 'email'] },
  5: { days: 30, tone: 'letter_of_demand',     channel: ['email'] },
}

function calculateEscalationTier(daysOverdue: number): number {
  if (daysOverdue >= 30) return 5
  if (daysOverdue >= 14) return 4
  if (daysOverdue >= 7)  return 3
  if (daysOverdue >= 3)  return 2
  if (daysOverdue >= 1)  return 1
  return 0
}

async function getOverdueInvoices(tenantId: string): Promise<Invoice[]> {
  const { data } = await supabaseAdmin
    .from('invoices')
    .select('*')
    .eq('tenant_id', tenantId)
    .in('status', ['unpaid', 'partial'])
    .gt('days_overdue', 0)
    .order('days_overdue', { ascending: false })
  return data || []
}

async function sendViaChannel(
  channel: string,
  invoice: Invoice,
  message: string,
  tenantName: string
): Promise<void> {
  if (channel === 'whatsapp' && invoice.contact_phone) {
    await sendWhatsApp({ to: invoice.contact_phone, message })
  } else if (channel === 'email' && invoice.contact_email) {
    await resend.emails.send({
      from: `${tenantName} <no-reply@adminos.co.za>`,
      to: invoice.contact_email,
      subject: `Payment reminder — R${invoice.amount} overdue`,
      text: message,
    })
  }
}

async function notifyManager(tenantId: string, notification: string): Promise<void> {
  await supabaseAdmin.from('audit_log').insert({
    tenant_id: tenantId,
    actor: 'system',
    action: 'manager.notification',
    metadata: { message: notification },
  })
}

export async function runDebtRecoverySequence(tenantId: string): Promise<void> {
  const { data: tenant } = await supabaseAdmin
    .from('tenants')
    .select('name')
    .eq('id', tenantId)
    .single()

  const overdueInvoices = await getOverdueInvoices(tenantId)

  for (const invoice of overdueInvoices) {
    const tier = calculateEscalationTier(invoice.days_overdue || 0)
    if (tier === 0 || tier === invoice.escalation_level) continue

    const tierConfig = ESCALATION_TIERS[tier]

    const message = await draftRecoveryMessage({
      tenantName: tenant?.name || 'The business',
      contact: invoice.contact_name,
      amount: invoice.amount,
      daysOverdue: invoice.days_overdue || 0,
      tone: tierConfig.tone,
      includePaymentLink: true,
    })

    for (const channel of tierConfig.channel) {
      try {
        await sendViaChannel(channel, invoice, message, tenant?.name || 'Business')
      } catch (err) {
        console.error(`[DebtRecovery] Failed to send via ${channel}:`, err)
      }
    }

    await supabaseAdmin
      .from('invoices')
      .update({
        escalation_level: tier,
        last_reminder_at: new Date().toISOString(),
      })
      .eq('id', invoice.id)

    await writeAuditLog({
      tenantId,
      actor: 'system',
      action: 'debt_recovery.reminder_sent',
      resourceType: 'invoice',
      resourceId: invoice.id,
      metadata: { tier, contact: invoice.contact_name, amount: invoice.amount },
    })

    await notifyManager(tenantId, `Debt recovery tier ${tier}: ${invoice.contact_name} — R${invoice.amount}`)
  }
}
