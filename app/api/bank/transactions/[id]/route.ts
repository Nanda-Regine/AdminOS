import { z } from 'zod'
import { withRoute, badRequest } from '@/lib/api/withRoute'
import { confirmMatch, setCategory, setIgnored } from '@/lib/bank/service'

/**
 * One change per request:
 *   { category, remember? }   categorise a line; remember=true teaches AdminOS that vendor
 *   { ignore: true|false }    hide a line that isn't business money (a personal transfer)
 *   { matchInvoiceId }        confirm this line paid that invoice — records the payment
 */
const patchSchema = z.object({
  category:       z.string().min(1).max(40).optional(),
  remember:       z.boolean().optional(),
  ignore:         z.boolean().optional(),
  matchInvoiceId: z.string().uuid().optional(),
}).refine((b) => [b.category, b.ignore, b.matchInvoiceId].filter((v) => v !== undefined).length === 1, {
  message: 'Send one of category, ignore or matchInvoiceId.',
})

export const PATCH = withRoute({
  action: 'bank.write',
  body: patchSchema,
  resourceType: 'bank_transaction',
  rateLimit: 'api',
}, async ({ ctx, body, params, audit }) => {
  const { tenantId, userId } = ctx
  const id = params.id

  if (body.matchInvoiceId) {
    const paid = await confirmMatch(tenantId, userId, id, body.matchInvoiceId)
    await audit({
      action: 'bank.matched_to_invoice',
      resourceId: id,
      metadata: { invoice_id: paid.invoiceId, status: paid.status, became_paid: paid.becamePaid, amount_paid: paid.amountPaid },
    })
    return paid
  }

  if (body.category) {
    const done = await setCategory(tenantId, userId, id, body.category, body.remember === true)
    await audit({ action: 'bank.categorised', resourceId: id, metadata: { category: body.category, remembered: done.ruleSaved } })
    return done
  }

  if (body.ignore !== undefined) {
    const done = await setIgnored(tenantId, id, body.ignore)
    await audit({ action: body.ignore ? 'bank.ignored' : 'bank.unignored', resourceId: id })
    return done
  }

  throw badRequest('Nothing to change.')
})
