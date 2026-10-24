import { z } from 'zod'
import { withRoute } from '@/lib/api/withRoute'
import { confirmHighConfidence } from '@/lib/bank/service'

const bodySchema = z.object({
  matches: z.array(z.object({ transactionId: z.string().uuid(), invoiceId: z.string().uuid() })).min(1).max(50),
})

/**
 * POST /api/bank/reconcile — confirm many suggested matches at once.
 * The server re-runs the matcher and only accepts a pair it still rates HIGH
 * confidence (invoice number or payer name plus the exact amount owed), so a
 * forged or stale request cannot mark an arbitrary invoice paid.
 */
export const POST = withRoute({
  action: 'bank.write',
  body: bodySchema,
  rateLimit: 'api',
}, async ({ ctx, body, audit }) => {
  const results = await confirmHighConfidence(ctx.tenantId, ctx.userId, body.matches)
  const ok = results.filter((r) => r.ok).length
  await audit({
    action: 'bank.bulk_matched',
    resourceType: 'bank_transaction',
    metadata: { requested: body.matches.length, matched: ok, invoices_settled: results.filter((r) => r.becamePaid).length },
  })
  return { matched: ok, failed: results.length - ok, results }
})
