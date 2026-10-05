import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'
import { withRoute, unwrap, notFound, badRequest } from '@/lib/api/withRoute'

const memberSchema = z.object({
  name:           z.string().trim().min(1).max(200),
  // Required by the DB (NOT NULL). The add-member form treats it as optional —
  // open product decision (see BUILD_JOURNEY build list), so the 400 says why.
  phone:          z.string({ error: 'A phone number is required for each member.' }).trim().min(7).max(20),
  payoutPosition: z.number().int().positive().max(1000).optional(),
})

const contributionSchema = z.object({
  memberId:    z.string().uuid(),
  periodMonth: z.number().int().min(1).max(12),
  periodYear:  z.number().int().min(2020).max(2099),
  amount:      z.number().positive().max(10_000_000),
  status:      z.enum(['pending','paid','late','excused']).default('paid'),
})

async function groupOf(tenantId: string, id: string) {
  return unwrap(await supabaseAdmin
    .from('stokvel_groups')
    .select('id')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .maybeSingle(), { required: true, what: 'Stokvel group not found' })
}

// GET /api/stokvel/[id] — group detail with members and contributions
export const GET = withRoute({ action: 'money.read' }, async ({ ctx, params }) =>
  unwrap(await supabaseAdmin
    .from('stokvel_groups')
    .select('*, members:stokvel_members(id, name, phone, payout_position, joined_at, deleted_at, contributions:stokvel_contributions(*))')
    .eq('id', params.id)
    .eq('tenant_id', ctx.tenantId)
    .is('deleted_at', null)
    .maybeSingle(), { required: true, what: 'Stokvel group not found' }),
)

// POST /api/stokvel/[id]?action=add_member | record_contribution
export const POST = withRoute({
  action: 'money.write',
  query: z.object({ action: z.enum(['add_member', 'record_contribution']) }),
  status: 201,
  resourceType: 'stokvel_group',
}, async ({ request, ctx, params, query, audit }) => {
  await groupOf(ctx.tenantId, params.id)
  const raw = await request.json().catch(() => { throw badRequest('Request body must be valid JSON.') })

  if (query.action === 'add_member') {
    const parsed = memberSchema.safeParse(raw)
    if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message ?? 'Invalid member')
    const body = parsed.data
    const data = unwrap(await supabaseAdmin
      .from('stokvel_members')
      .insert({
        group_id:        params.id,
        tenant_id:       ctx.tenantId,
        name:            body.name,
        phone:           body.phone,
        payout_position: body.payoutPosition ?? null,
      })
      .select()
      .single())
    await audit({ action: 'stokvel.member_added', resourceType: 'stokvel_group', resourceId: params.id })
    return data
  }

  const parsed = contributionSchema.safeParse(raw)
  if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message ?? 'Invalid contribution')
  const body = parsed.data

  // The member must belong to THIS group in THIS tenant. stokvel_contributions
  // has no tenant_id, and this used to accept any member UUID — including a
  // member of another business's group.
  const member = unwrap(await supabaseAdmin
    .from('stokvel_members')
    .select('id')
    .eq('id', body.memberId)
    .eq('group_id', params.id)
    .eq('tenant_id', ctx.tenantId)
    .is('deleted_at', null)
    .maybeSingle())
  if (!member) throw notFound('That member is not in this group.')

  const data = unwrap(await supabaseAdmin
    .from('stokvel_contributions')
    .upsert({
      group_id:     params.id,
      member_id:    body.memberId,
      period_month: body.periodMonth,
      period_year:  body.periodYear,
      amount:       body.amount,
      status:       body.status,
      paid_at:      body.status === 'paid' ? new Date().toISOString() : null,
    }, { onConflict: 'group_id,member_id,period_month,period_year' })
    .select()
    .single())
  await audit({
    action: 'stokvel.contribution_recorded',
    resourceType: 'stokvel_group',
    resourceId: params.id,
    metadata: { member_id: body.memberId, period: `${body.periodYear}-${body.periodMonth}`, amount: body.amount, status: body.status },
  })
  return data
})
