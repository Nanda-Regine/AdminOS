import { supabaseAdmin } from '@/lib/supabase/admin'
import { sendWhatsApp } from '@/lib/whatsapp/send'
import { notifyTenant } from '@/lib/notifications/notify'
import { getTenantAutonomy } from '@/lib/autonomy/config'
import { resolveTier } from '@/lib/autonomy/tiers'
import { fireBusinessEvent } from '@/lib/academy/knowledgeGraph'

export interface PaidInvoice {
  id: string
  tenant_id: string
  contact_name: string | null
  contact_phone: string | null
  amount: number
  amount_paid: number | null
  reference: string | null
}

/**
 * Side effects for "this invoice just became paid" — owner alert,
 * formalization bump, autonomy-gated customer thank-you (money/payment_receipt).
 * Shared by the invoice PATCH route and the Quick Sale (cash-sale) create
 * path so both get identical behavior instead of two hand-rolled copies.
 */
export async function handleInvoicePaid(invoice: PaidInvoice, userId: string): Promise<void> {
  fireBusinessEvent('invoice.paid', invoice.tenant_id, userId)

  // Celebrate the win — the owner gets pushed the moment money lands.
  await notifyTenant(invoice.tenant_id, {
    type: 'payment.received',
    title: 'Payment received 🎉',
    body: `${invoice.contact_name ?? 'A customer'} paid ${invoice.amount ? 'R' + Number(invoice.amount).toLocaleString('en-ZA') : 'their invoice'}.`,
    actionUrl: '/dashboard/money',
    dedupeKey: `paid-${invoice.id}`,
    whatsapp: true,
  })

  await supabaseAdmin
    .from('formalization_progress')
    .update({ first_invoice_sent: true })
    .eq('tenant_id', invoice.tenant_id)
    .eq('first_invoice_sent', false)

  // Autonomy: money/payment_receipt — thank the customer automatically.
  // Default tier is 'A' (send). 'B'/'C' hold — the owner alert above
  // already tells them the payment landed, so no extra draft is needed.
  if (invoice.contact_phone) {
    const tier = resolveTier(await getTenantAutonomy(invoice.tenant_id), 'money', 'payment_receipt')
    if (tier === 'A') {
      const amountStr = `R${Number(invoice.amount_paid ?? invoice.amount).toLocaleString('en-ZA')}`
      const ref = invoice.reference ?? invoice.id.slice(0, 8)
      const thankYou = `Hi ${invoice.contact_name ?? 'there'}, thank you — we've received your payment of ${amountStr} for invoice ${ref}. Much appreciated!`
      try {
        await sendWhatsApp({ to: invoice.contact_phone, message: thankYou })
      } catch (err) {
        console.error('[invoices] payment receipt send failed (non-fatal)', err)
      }
    }
  }
}
