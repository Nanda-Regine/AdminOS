import { z } from 'zod'
import { withRoute } from '@/lib/api/withRoute'
import { getClientIp } from '@/lib/security/audit'
import { requestAccountDeletion } from '@/lib/account/deletion'

const schema = z.object({
  // Typed confirmation, so a stray tap can't disable someone's login.
  confirm: z.literal('DELETE', { message: 'Type DELETE to confirm.' }),
  reason:  z.string().trim().max(1000).optional(),
  source:  z.enum(['app', 'web']).default('app'),
})

// POST /api/account/delete — the caller deletes their own login. See
// lib/account/deletion.ts for exactly what is disabled, anonymised and kept.
export const POST = withRoute({
  action: 'profile.own',
  body: schema,
  rateLimit: 'api',
}, async ({ request, ctx, body }) => {
  const result = await requestAccountDeletion({
    userId: ctx.userId,
    tenantId: ctx.tenantId,
    role: ctx.role,
    reason: body.reason,
    source: body.source,
    ipAddress: getClientIp(request),
  })
  return { ok: true, ...result }
})
