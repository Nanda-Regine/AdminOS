import { z } from 'zod'
import { withRoute, RouteError, unwrap } from '@/lib/api/withRoute'
import { inngest } from '@/inngest/client'
import { hasAdminOSPlan } from '@/lib/billing/planGates'

// The board pack is the business's full financial picture (revenue, debtors,
// payroll cost, compliance). It had no role check: on a Scale tenant any login,
// a driver or an external client included, could list and generate packs.
// Now money.read (view_financials) — the same permission the page checks.

const PLAN_REQUIRED = () => new RouteError(402, 'Board packs are on the Scale plan or higher.', 'plan_required')

const generateSchema = z.object({
  periodLabel: z.string().trim().min(1).max(100),
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodEnd:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
}).refine((b) => b.periodStart <= b.periodEnd, { message: 'Start must be on or before end', path: ['periodEnd'] })

const listQuery = z.object({
  limit: z.coerce.number().int().min(1).max(24).default(12),
})

export const GET = withRoute(
  { action: 'money.read', query: listQuery },
  async ({ ctx, query }) => {
    if (!(await hasAdminOSPlan('scale'))) throw PLAN_REQUIRED()
    return unwrap(await ctx.db
      .from('board_packs')
      .select('id, period_label, period_start, period_end, status, created_at, pdf_url')
      .eq('tenant_id', ctx.tenantId)
      .order('period_start', { ascending: false })
      .limit(query.limit)) ?? []
  },
)

export const POST = withRoute(
  { action: 'money.read', body: generateSchema, audit: 'board_pack.requested', resourceType: 'board_pack', rateLimit: 'agents' },
  async ({ ctx, body }) => {
    if (!(await hasAdminOSPlan('scale'))) throw PLAN_REQUIRED()

    const pack = unwrap(await ctx.db
      .from('board_packs')
      .insert({
        tenant_id:    ctx.tenantId,
        generated_by: ctx.userId,
        period_label: body.periodLabel,
        period_start: body.periodStart,
        period_end:   body.periodEnd,
        pack_data:    {},
        status:       'generating',
      })
      .select('id')
      .single(), { required: true })

    await inngest.send({
      name: 'adminos/board_pack.generate',
      data: {
        tenant_id:     ctx.tenantId,
        board_pack_id: pack.id,
        period_start:  body.periodStart,
        period_end:    body.periodEnd,
        period_label:  body.periodLabel,
      },
    })

    return { id: pack.id, status: 'generating' }
  },
)
