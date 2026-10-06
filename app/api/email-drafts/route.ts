import { z } from 'zod'
import { withRoute } from '@/lib/api/withRoute'

const DRAFT_COLUMNS =
  'id, email_type, category, subject, body, recipient_name, recipient_email, tone_used, language_used, status, sent_at, created_at'

const listQuery = z.object({ page: z.coerce.number().int().min(1).catch(1) })

// Was open to any login (no role check) and returned raw DB errors.
export const GET = withRoute({ action: 'email.drafts', query: listQuery }, async ({ ctx, query }) => {
  const limit = 20
  const offset = (query.page - 1) * limit
  const { data, count, error } = await ctx.db
    .from('email_drafts')
    .select(DRAFT_COLUMNS, { count: 'exact' })
    .eq('tenant_id', ctx.tenantId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)
  if (error) throw error
  return { data: data ?? [], count: count ?? 0, page: query.page, limit }
})
