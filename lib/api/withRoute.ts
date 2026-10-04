/**
 * withRoute() — the one way to write an authenticated AdminOS API route.
 *
 *   export const POST = withRoute(
 *     { action: 'payroll.distribute', body: schema, audit: 'payroll.distributed', resourceType: 'payroll_run' },
 *     async ({ ctx, body, params }) => {
 *       const run = unwrap(await ctx.db.from('payroll_runs').select('id, status')
 *         .eq('id', params.id).eq('tenant_id', ctx.tenantId).maybeSingle(), { required: true })
 *       …
 *       return { id: run.id, status: 'distributed' }
 *     },
 *   )
 *
 * You get: verified identity + tenant (app_metadata, fail-closed), a role check
 * against lib/auth/roleMatrix.ts, zod-validated body/query with per-field 400s,
 * DB errors mapped to friendly messages (never raw constraint names), an audit
 * row on success, optional per-tenant rate limiting, and unexpected errors
 * reported to PostHog. See lib/api/handler.ts for the mechanics.
 *
 * Not for public routes (webhooks, booking widget, signing links) — those
 * authenticate by signature/token and have no tenant session.
 */

import { getContext, type Context } from '@/lib/auth/context'
import { can } from '@/lib/auth/roleMatrix'
import { writeAuditLog, getClientIp } from '@/lib/security/audit'
import { checkRateLimit } from '@/lib/security/rateLimit'
import { getPostHogServer } from '@/lib/posthog/server'
import { createRouteFactory } from '@/lib/api/handler'

export { RouteError, notFound, badRequest, conflict, unwrap } from '@/lib/api/handler'

type LimiterKey = Parameters<typeof checkRateLimit>[0]

export const withRoute = createRouteFactory<Context>({
  getContext,

  authorize: (ctx, action) => can(ctx, action),

  audit: (ctx, entry, request) =>
    writeAuditLog({
      tenantId: ctx.tenantId,
      actor: ctx.userId,
      action: entry.action,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId,
      metadata: { role: ctx.role, ...entry.metadata },
      ipAddress: getClientIp(request),
    }),

  async report(error, info) {
    console.error('[withRoute]', info, error)
    const ph = getPostHogServer()
    if (!ph) return
    ph.captureException(error as Error, (info.userId as string | undefined) ?? undefined, info)
    await ph.flush()
  },

  async rateLimit(key, identifier) {
    const { success } = await checkRateLimit(key as LimiterKey, identifier)
    return success
  },
})
