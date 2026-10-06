import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { calculateValuation, saveValuationSnapshot } from '@/lib/intelligence/valuation'
import { fireBusinessEvent } from '@/lib/academy/knowledgeGraph'
import { withRoute, unwrap } from '@/lib/api/withRoute'
import { sastDate } from '@/lib/time/sast'

// GET /api/valuation[?refresh=true] — today's valuation snapshot (cached per day).
// Was open to any logged-in member of the tenant; a business valuation is financials.
export const GET = withRoute({
  action: 'money.read',
  query: z.object({ refresh: z.enum(['true', 'false']).optional() }),
}, async ({ ctx, query }) => {
  const { tenantId, userId } = ctx
  const today = sastDate()

  if (query.refresh !== 'true') {
    const cached = unwrap(await supabaseAdmin
      .from('valuation_snapshots')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('snapshot_date', today)
      .maybeSingle())
    if (cached) return cached
  }

  const result = await calculateValuation(tenantId)
  await saveValuationSnapshot(result)

  // First valuation — trigger the Built to Sell framework
  const { count } = await supabaseAdmin
    .from('valuation_snapshots')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
  if ((count ?? 0) === 1) fireBusinessEvent('exit.score_calculated', tenantId, userId)

  return result
})
