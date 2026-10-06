import { withRoute, RouteError, unwrap } from '@/lib/api/withRoute'
import { hasAdminOSPlan } from '@/lib/billing/planGates'

// One board pack, with its full pack_data. Same gate as the list: money.read
// (view_financials) plus the Scale plan. Had no role check before.
export const GET = withRoute(
  { action: 'money.read' },
  async ({ ctx, params }) => {
    if (!(await hasAdminOSPlan('scale'))) {
      throw new RouteError(402, 'Board packs are on the Scale plan or higher.', 'plan_required')
    }
    return unwrap(await ctx.db
      .from('board_packs')
      .select('id, period_label, period_start, period_end, status, pack_data, pdf_url, generated_by, created_at')
      .eq('id', params.id)
      .eq('tenant_id', ctx.tenantId)
      .maybeSingle(), { required: true, what: 'Board pack' })
  },
)
