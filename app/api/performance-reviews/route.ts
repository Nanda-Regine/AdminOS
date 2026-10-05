import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'
import { withRoute, unwrap, notFound } from '@/lib/api/withRoute'
import { isTenantStaff } from '@/lib/people/ownStaff'

const createSchema = z.object({
  staffId:      z.string().uuid(),
  reviewPeriod: z.string().max(50).optional(),
  ratings:      z.record(z.string().max(100), z.number().min(1).max(5)).optional(),
  comments:     z.string().max(5000).optional(),
  goalsSet:     z.array(z.object({
    title:       z.string().trim().min(1).max(300),
    target_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  })).max(50).optional(),
})

const listQuery = z.object({ staffId: z.string().uuid().optional() })
const COLUMNS = 'id, staff_id, reviewer_id, review_period, ratings, comments, goals_set, status, created_at'

export const GET = withRoute({ action: 'hr.records', query: listQuery }, async ({ ctx, query }) => {
  let q = supabaseAdmin
    .from('performance_reviews')
    .select(`${COLUMNS}, staff(full_name, job_title)`)
    .eq('tenant_id', ctx.tenantId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(500)
  if (query.staffId) q = q.eq('staff_id', query.staffId)
  return unwrap(await q) ?? []
})

export const POST = withRoute({
  action: 'hr.records',
  body: createSchema,
  status: 201,
  audit: 'performance_review.created',
  resourceType: 'performance_review',
}, async ({ ctx, body }) => {
  if (!(await isTenantStaff(ctx.tenantId, body.staffId))) throw notFound('Staff member not found')
  return unwrap(await supabaseAdmin
    .from('performance_reviews')
    .insert({
      tenant_id:     ctx.tenantId,
      staff_id:      body.staffId,
      reviewer_id:   ctx.userId,
      review_period: body.reviewPeriod ?? null,
      ratings:       body.ratings      ?? null,
      comments:      body.comments     ?? null,
      goals_set:     body.goalsSet     ?? null,
      status:        'draft',
    })
    .select(COLUMNS)
    .single(), { required: true })
})
