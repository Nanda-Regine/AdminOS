import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'
import { fireBusinessEvent } from '@/lib/academy/knowledgeGraph'
import { withRoute, unwrap } from '@/lib/api/withRoute'

// Stokvel groups the business administers — members' money, so finance-only
// (same view_financials boundary as the stokvel page). Both handlers used to
// be open to any logged-in member.

const createSchema = z.object({
  name:               z.string().trim().min(1).max(300),
  contributionAmount: z.number().positive().max(10_000_000),
  frequency:          z.enum(['weekly','fortnightly','monthly']).default('monthly'),
  payoutOrder:        z.enum(['rotation','lottery','fixed']).default('rotation'),
  startDate:          z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  rules:              z.string().max(5000).optional(),
})

export const GET = withRoute({ action: 'money.read' }, async ({ ctx }) =>
  unwrap(await supabaseAdmin
    .from('stokvel_groups')
    .select('id, name, contribution_amount, frequency, payout_order, start_date, status, rules, created_at, members:stokvel_members(count)')
    .eq('tenant_id', ctx.tenantId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(200)) ?? [],
)

export const POST = withRoute({
  action: 'money.write',
  body: createSchema,
  status: 201,
  audit: 'stokvel.created',
  resourceType: 'stokvel_group',
}, async ({ ctx, body }) => {
  const data = unwrap(await supabaseAdmin
    .from('stokvel_groups')
    .insert({
      tenant_id:           ctx.tenantId,
      name:                body.name,
      contribution_amount: body.contributionAmount,
      frequency:           body.frequency,
      payout_order:        body.payoutOrder,
      start_date:          body.startDate ?? null,
      rules:               body.rules     ?? null,
    })
    .select()
    .single())

  fireBusinessEvent('stokvel.created', ctx.tenantId, ctx.userId)
  return data
})
