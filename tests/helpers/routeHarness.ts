// Route test harness — drives the real withRoute core (lib/api/handler.ts)
// with a fake caller instead of a Supabase session, so every route's authz
// contract (no session → 401, wrong role → 403, bad input → 400) is testable
// without a database.
//
// What this cannot prove: tenant isolation of the data itself (another
// tenant's id → 404). That lives in the route's own query filters + RLS and
// needs a real database — see BUILD_JOURNEY Session 17, Phase 1(f).

import { createRouteFactory, type BaseContext, type AuditInput } from '../../lib/api/handler.ts'
import { can, DEFAULT_ROLE_PERMISSIONS, type RoleName } from '../../lib/auth/roleMatrix.ts'

export interface FakeCaller {
  role: RoleName
  tenantId?: string
  userId?: string
  isSuperAdmin?: boolean
  /** Override the default permission set (tenants can customise roles). */
  permissions?: string[]
}

export interface Harness {
  withRoute: ReturnType<typeof createRouteFactory<BaseContext>>
  audits: Array<AuditInput & { tenantId: string; actor: string }>
  reports: Array<{ error: unknown; info: Record<string, unknown> }>
  /** Switch the caller between calls; null = no session. */
  as(caller: FakeCaller | null): void
  /** Make the rate limiter refuse the next calls. */
  limit(blocked: boolean): void
}

export function harness(initial: FakeCaller | null = { role: 'owner' }): Harness {
  let caller = initial
  let blocked = false
  const audits: Harness['audits'] = []
  const reports: Harness['reports'] = []

  const withRoute = createRouteFactory<BaseContext>({
    async getContext() {
      if (!caller) return null
      return {
        userId: caller.userId ?? `user-${caller.role}`,
        tenantId: caller.tenantId ?? 'tenant-a',
        role: caller.role,
        permissions: caller.permissions ?? DEFAULT_ROLE_PERMISSIONS[caller.role],
        isSuperAdmin: caller.isSuperAdmin ?? false,
      }
    },
    authorize: (ctx, action) => can(ctx, action),
    async audit(ctx, entry) {
      audits.push({ ...entry, tenantId: ctx.tenantId, actor: ctx.userId })
    },
    report(error, info) {
      reports.push({ error, info })
    },
    async rateLimit() {
      return !blocked
    },
  })

  return {
    withRoute,
    audits,
    reports,
    as(next) { caller = next },
    limit(b) { blocked = b },
  }
}

type RouteFn = (request: Request, segment: { params: Promise<Record<string, string>> }) => Promise<Response>

/** Call a route the way Next does. Returns status + parsed JSON (or text). */
export async function call(
  route: RouteFn,
  opts: { method?: string; body?: unknown; rawBody?: string; params?: Record<string, string>; query?: Record<string, string> } = {},
): Promise<{ status: number; body: any }> {
  const url = new URL('https://adminos.test/api/x')
  for (const [k, v] of Object.entries(opts.query ?? {})) url.searchParams.set(k, v)
  const hasBody = opts.body !== undefined || opts.rawBody !== undefined
  const request = new Request(url, {
    method: opts.method ?? (hasBody ? 'POST' : 'GET'),
    headers: { 'Content-Type': 'application/json' },
    body: opts.rawBody ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
  })
  const res = await route(request, { params: Promise.resolve(opts.params ?? {}) })
  const text = await res.text()
  let body: unknown = text
  try { body = JSON.parse(text) } catch { /* non-JSON response */ }
  return { status: res.status, body }
}
