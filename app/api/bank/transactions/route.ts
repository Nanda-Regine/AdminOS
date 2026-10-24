import { z } from 'zod'
import { withRoute } from '@/lib/api/withRoute'
import { bankSummary, listTransactions } from '@/lib/bank/service'

const query = z.object({
  status: z.enum(['all', 'unmatched', 'matched', 'ignored']).default('unmatched'),
  page: z.coerce.number().int().min(1).max(500).default(1),
})
const PAGE_SIZE = 50

// GET /api/bank/transactions — imported bank lines (newest first) with fresh invoice-match
// suggestions on unmatched money-in lines, plus the totals the page header shows.
export const GET = withRoute({ action: 'bank.read', query }, async ({ ctx, query }) => {
  const [list, summary] = await Promise.all([
    listTransactions(ctx.tenantId, { status: query.status, limit: PAGE_SIZE, offset: (query.page - 1) * PAGE_SIZE }),
    bankSummary(ctx.tenantId),
  ])
  return { ...list, page: query.page, pageSize: PAGE_SIZE, summary }
})
