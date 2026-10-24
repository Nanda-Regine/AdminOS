import { supabaseAdmin } from '@/lib/supabase/admin'
import { handleInvoicePaid } from '@/lib/invoices/onPaid'
import { paymentState } from '@/lib/invoices/status'
import { unwrap, conflict, badRequest } from '@/lib/api/withRoute'

const PAYABLE = ['sent', 'unpaid', 'partial', 'overdue', 'in_collections']

export interface RecordedPayment {
  invoiceId: string
  reference: string | null
  contactName: string | null
  status: string
  amountPaid: number
  amountDue: number
  becamePaid: boolean
}

/**
 * Add money received to an invoice — the same rules as PATCH /api/invoices/[id]
 * { payment }: only payable statuses, never more than is owed, an
 * amount_paid-guarded write so two people (or a double-click) can't both add it,
 * and the paid side effects (owner alert, receipt eligibility, customer thank-you)
 * when it settles in full. Used when a bank line is matched to an invoice.
 */
export async function recordInvoicePayment(
  tenantId: string,
  userId: string,
  invoiceId: string,
  amount: number,
  method: 'eft' | 'cash' | 'card' | 'mobile_money' | 'other' = 'eft',
): Promise<RecordedPayment> {
  const before = unwrap(await supabaseAdmin
    .from('invoices')
    .select('id, status, amount, amount_paid, reference, contact_name, contact_phone')
    .eq('id', invoiceId)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .maybeSingle(), { required: true, what: 'Invoice not found' })

  if (!PAYABLE.includes(before.status)) {
    throw conflict(`Payments can't be recorded on a ${String(before.status).replace('_', ' ')} invoice.`)
  }
  const total = Number(before.amount ?? 0)
  const paidBefore = Number(before.amount_paid ?? 0)
  const newPaid = Math.round((paidBefore + amount) * 100) / 100
  if (newPaid > total + 0.005) {
    throw badRequest(`That's more than the invoice total. R${(total - paidBefore).toFixed(2)} is outstanding.`)
  }

  const state = paymentState(total, newPaid)
  const updates: Record<string, unknown> = {
    amount_paid: state.amount_paid,
    amount_due: state.amount_due,
    status: before.status === 'in_collections' && state.status !== 'paid' ? 'in_collections' : (state.status ?? 'unpaid'),
    payment_method: method,
  }
  if (state.status === 'paid') updates.paid_at = new Date().toISOString()

  const data = unwrap(await supabaseAdmin
    .from('invoices')
    .update(updates)
    .eq('id', invoiceId)
    .eq('tenant_id', tenantId)
    .eq('amount_paid', paidBefore)
    .select()
    .maybeSingle())
  if (!data) throw conflict('This invoice was just changed by someone else — refresh and try again.')

  const becamePaid = before.status !== 'paid' && data.status === 'paid'
  if (becamePaid) {
    await handleInvoicePaid({
      id: data.id, tenant_id: tenantId, contact_name: data.contact_name, contact_phone: data.contact_phone,
      amount: data.amount, amount_paid: data.amount_paid, reference: data.reference,
    }, userId)
  }

  return {
    invoiceId,
    reference: data.reference ?? null,
    contactName: data.contact_name ?? null,
    status: data.status,
    amountPaid: Number(data.amount_paid),
    amountDue: Number(data.amount_due),
    becamePaid,
  }
}
