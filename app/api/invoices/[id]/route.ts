import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'
import { fireBusinessEvent } from '@/lib/academy/knowledgeGraph'
import { handleInvoicePaid } from '@/lib/invoices/onPaid'
import { paymentState } from '@/lib/invoices/status'
import { softDelete } from '@/lib/db/softDelete'
import { withRoute, unwrap, notFound, conflict, badRequest } from '@/lib/api/withRoute'

export const GET = withRoute({ action: 'invoices.read' }, async ({ ctx, params }) =>
  unwrap(await supabaseAdmin
    .from('invoices')
    .select('*, contact:contacts(name:full_name, email, phone)')
    .eq('id', params.id)
    .eq('tenant_id', ctx.tenantId)
    .is('deleted_at', null)
    .maybeSingle(), { required: true, what: 'Invoice not found' }),
)

/**
 * One change per request:
 *   { payment: { amount, method? } }  record money received (adds to amount_paid)
 *   { amountPaid }                    set the cumulative amount paid (correction)
 *   { status: 'sent' }                issue a draft
 *   { status: 'paid' }                mark settled in full
 *   { status: 'cancelled' }           void an unpaid invoice
 *   { status: 'in_collections' }      handed to a third party — AdminOS stops chasing
 *   { dueDate } / { notes }           edit
 *
 * unpaid/partial/overdue are derived, not set by hand: the old schema let a
 * client set 'paid' without touching amount_paid, so a "paid" invoice still
 * showed its full amount_due on documents, AR and the health score.
 */
const patchSchema = z.object({
  status:     z.enum(['sent', 'paid', 'cancelled', 'in_collections']).optional(),
  dueDate:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes:      z.string().max(2000).optional(),
  amountPaid: z.number().nonnegative().optional(),
  payment:    z.object({
    amount: z.number().positive(),
    method: z.enum(['cash', 'card', 'eft', 'mobile_money', 'other']).optional(),
  }).optional(),
}).refine((b) => [b.status, b.amountPaid, b.payment].filter((v) => v !== undefined).length <= 1, {
  message: 'Send one of status, amountPaid or payment per request.',
})

const TRANSITIONS: Record<string, readonly string[]> = {
  sent:           ['draft'],
  paid:           ['sent', 'unpaid', 'partial', 'overdue', 'in_collections'],
  cancelled:      ['draft', 'sent', 'unpaid', 'overdue'],          // not once money has come in
  in_collections: ['sent', 'unpaid', 'partial', 'overdue'],
}
const PAYABLE = ['sent', 'unpaid', 'partial', 'overdue', 'in_collections']

export const PATCH = withRoute({
  action: 'invoices.write',
  body: patchSchema,
  resourceType: 'invoice',
}, async ({ ctx, body, params, audit }) => {
  const { tenantId, userId } = ctx
  const id = params.id

  const before = unwrap(await supabaseAdmin
    .from('invoices')
    .select('id, status, amount, amount_paid')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .maybeSingle(), { required: true, what: 'Invoice not found' })

  const amount = Number(before.amount ?? 0)
  const paidBefore = Number(before.amount_paid ?? 0)
  const now = new Date().toISOString()
  const updates: Record<string, unknown> = {}
  let auditAction = 'invoice.updated'

  if (body.dueDate !== undefined) updates.due_date = body.dueDate
  if (body.notes !== undefined) updates.notes = body.notes

  if (body.status) {
    if (before.status === body.status) throw conflict(`This invoice is already ${body.status.replace('_', ' ')}.`)
    if (!TRANSITIONS[body.status].includes(before.status)) {
      throw conflict(`A ${before.status.replace('_', ' ')} invoice can't be marked ${body.status.replace('_', ' ')}.`)
    }
    updates.status = body.status
    if (body.status === 'sent') updates.sent_at = now
    if (body.status === 'paid') {
      Object.assign(updates, { amount_paid: amount, amount_due: 0, paid_at: now })
    }
    if (body.status === 'cancelled') updates.amount_due = 0
    auditAction = `invoice.${body.status}`
  }

  if (body.payment || body.amountPaid !== undefined) {
    if (!PAYABLE.includes(before.status)) {
      throw conflict(`Payments can't be recorded on a ${before.status.replace('_', ' ')} invoice.`)
    }
    const newPaid = body.payment ? Math.round((paidBefore + body.payment.amount) * 100) / 100 : body.amountPaid!
    if (newPaid > amount + 0.005) {
      throw badRequest(`That's more than the invoice total. R${(amount - paidBefore).toFixed(2)} is outstanding.`)
    }
    const state = paymentState(amount, newPaid)
    Object.assign(updates, { amount_paid: state.amount_paid, amount_due: state.amount_due })
    // A correction back to 0 returns it to 'unpaid'; in_collections stays put until paid in full.
    updates.status = state.status ?? 'unpaid'
    if (before.status === 'in_collections' && state.status !== 'paid') updates.status = 'in_collections'
    if (state.status === 'paid') updates.paid_at = now
    if (body.payment?.method) updates.payment_method = body.payment.method
    auditAction = body.payment ? 'invoice.payment_recorded' : 'invoice.payment_corrected'
  }

  if (Object.keys(updates).length === 0) throw badRequest('Nothing to change.')

  // Conditional on amount_paid not having moved since we read it, so two people
  // recording the same payment at once can't both add it.
  const data = unwrap(await supabaseAdmin
    .from('invoices')
    .update(updates)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .eq('amount_paid', paidBefore)
    .select()
    .maybeSingle())
  if (!data) throw conflict('This invoice was just changed by someone else — refresh and try again.')

  await audit({
    action: auditAction,
    resourceType: 'invoice',
    resourceId: id,
    metadata: {
      from_status: before.status,
      to_status: data.status,
      ...(body.payment ? { payment: body.payment.amount } : {}),
      ...(body.amountPaid !== undefined ? { amount_paid: { from: paidBefore, to: body.amountPaid } } : {}),
    },
  })

  if (body.status === 'sent') fireBusinessEvent('invoice.sent', tenantId, userId)
  if (before.status !== 'paid' && data.status === 'paid') {
    await handleInvoicePaid({
      id: data.id, tenant_id: tenantId, contact_name: data.contact_name, contact_phone: data.contact_phone,
      amount: data.amount, amount_paid: data.amount_paid, reference: data.reference,
    }, userId)
  }

  return data
})

// Drafts only — anything that has been sent is a tax document and is cancelled, not deleted.
export const DELETE = withRoute({
  action: 'invoices.write',
  audit: 'invoice.deleted',
  resourceType: 'invoice',
}, async ({ ctx, params }) => {
  const inv = unwrap(await supabaseAdmin
    .from('invoices')
    .select('id, status')
    .eq('id', params.id)
    .eq('tenant_id', ctx.tenantId)
    .is('deleted_at', null)
    .maybeSingle(), { required: true, what: 'Invoice not found' })
  if (inv.status !== 'draft') throw conflict('Only drafts can be deleted. Cancel a sent invoice instead.')
  if (!(await softDelete(supabaseAdmin, 'invoices', { id: params.id, tenantId: ctx.tenantId }))) throw notFound('Invoice not found')
  return { id: params.id, deleted: true }
})
