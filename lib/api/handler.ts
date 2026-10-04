/**
 * Route handler core — the framework-free half of withRoute().
 *
 * Every authenticated API route answers the same six questions: who is this,
 * which tenant, may they do this, is the input valid, what do we tell them if
 * it fails, and what goes in the audit log. 149 routes answered them by hand
 * and the 2026-10-04 baseline shows how that went (88 with no role check, 85
 * leaking raw DB errors, 98 writes unaudited). This answers them once.
 *
 * Nothing here imports Next, Supabase or the `@/` alias — dependencies are
 * injected — so tests drive it directly with fake contexts
 * (tests/helpers/routeHarness.ts). lib/api/withRoute.ts binds the real ones.
 */

import type { z, ZodType } from 'zod'
import type { Action } from '@/lib/auth/roleMatrix'

// ─── Errors ─────────────────────────────────────────────────────────────────

/** Throw from a handler to send a deliberate, user-safe 4xx/5xx. */
export class RouteError extends Error {
  // Plain fields, not constructor parameter properties: tests load this file
  // under node's strip-only TypeScript mode, which rejects those.
  readonly status: number
  readonly code?: string
  constructor(status: number, message: string, code?: string) {
    super(message)
    this.name = 'RouteError'
    this.status = status
    this.code = code
  }
}

export const notFound = (what = 'Not found') => new RouteError(404, what, 'not_found')
export const badRequest = (message: string) => new RouteError(400, message, 'bad_request')
export const conflict = (message: string) => new RouteError(409, message, 'conflict')

/**
 * Postgres / PostgREST error codes → friendly messages. The raw text
 * ("duplicate key value violates unique constraint contacts_tenant_phone_key")
 * names tables and constraints — schema reconnaissance for an attacker and
 * gibberish for a salon owner. Unmapped codes become a generic 500.
 */
const DB_ERRORS: Record<string, [number, string]> = {
  '23505': [409, 'That record already exists.'],
  '23503': [409, 'This is linked to other records, or refers to one that no longer exists.'],
  '23502': [400, 'A required field is missing.'],
  '23514': [400, 'One of the values is not allowed.'],
  '22P02': [400, 'One of the values has the wrong format.'],
  '22001': [400, 'One of the values is too long.'],
  '42501': [403, 'You do not have access to this.'],
  PGRST116: [404, 'Not found'],
}

interface DbErrorLike { code: string; message: string; details?: unknown; hint?: unknown }

function isDbError(e: unknown): e is DbErrorLike {
  return typeof e === 'object' && e !== null
    && typeof (e as DbErrorLike).code === 'string'
    && typeof (e as DbErrorLike).message === 'string'
    && !(e instanceof RouteError)
}

/**
 * Unwrap a Supabase `{ data, error }` result: throw the error (mapped later to
 * a friendly response) or return the data. With `{ required: true }`, a null
 * result is a 404 — use after `.maybeSingle()` on a tenant-filtered lookup, so
 * another tenant's id and a non-existent id are indistinguishable.
 */
// Generic over the whole result, not `data`: supabase-js returns a union
// ({ data: X, error: null } | { data: null, error: E }), and inferring T from
// `data` across that union collapses to `null`.
type Result = { data: unknown; error: unknown }
export function unwrap<R extends Result>(result: R, opts: { required: true; what?: string }): NonNullable<R['data']>
export function unwrap<R extends Result>(result: R, opts?: { required?: false }): R['data'] | null
export function unwrap<R extends Result>(
  result: R,
  opts: { required?: boolean; what?: string } = {},
): R['data'] | null {
  if (result.error) throw result.error
  if (opts.required && result.data == null) throw notFound(opts.what)
  return result.data
}

export interface ErrorBody { error: string; code?: string; fields?: Record<string, string> }

/** Map anything thrown inside a route to [status, body, shouldReport]. */
export function mapError(e: unknown): [number, ErrorBody, boolean] {
  if (e instanceof RouteError) return [e.status, { error: e.message, code: e.code }, e.status >= 500]
  const name = (e as { name?: string } | null)?.name
  if (name === 'AuthError') return [401, { error: 'Not authorised', code: 'unauthenticated' }, false]
  if (name === 'PermissionError') return [403, { error: 'You do not have permission to do this.', code: 'forbidden' }, false]
  if (isDbError(e)) {
    const mapped = DB_ERRORS[e.code]
    if (mapped) return [mapped[0], { error: mapped[1], code: `db_${e.code}` }, false]
  }
  return [500, { error: 'Something went wrong. Please try again.', code: 'internal' }, true]
}

// ─── Config ─────────────────────────────────────────────────────────────────

/** The minimum a resolved caller must carry. lib/auth/context.ts's Context satisfies it. */
export interface BaseContext {
  userId: string
  tenantId: string
  role: string
  permissions: readonly string[]
  isSuperAdmin: boolean
}

export interface AuditInput {
  action: string
  resourceType?: string
  resourceId?: string
  metadata?: Record<string, unknown>
}

export interface RouteDeps<C extends BaseContext> {
  getContext(): Promise<C | null>
  authorize(ctx: C, action: Action): boolean
  audit(ctx: C, entry: AuditInput, request: Request): Promise<void>
  report(error: unknown, info: Record<string, unknown>): Promise<void> | void
  /** Returns false when the caller is over the limit. */
  rateLimit?(key: string, identifier: string): Promise<boolean>
}

type Out<S> = S extends ZodType ? z.output<S> : undefined

export interface RouteConfig<B extends ZodType | undefined, Q extends ZodType | undefined> {
  /** Role-matrix action this route performs. Required — there is no default. */
  action: Action
  /** Validates the JSON body (non-GET). Failures → 400 with per-field messages. */
  body?: B
  /** Validates URL search params (as a flat string record). */
  query?: Q
  /**
   * Audit-log action written after a successful response, e.g. 'payroll.distributed'.
   * resourceId defaults to the handler result's `id`, then `params.id`.
   * For anything richer, call `audit()` from the handler instead.
   */
  audit?: string
  resourceType?: string
  /** Success status for plain-data returns (default 200). */
  status?: number
  /** Rate-limit bucket, keyed per tenant. */
  rateLimit?: string
}

/** Dynamic segments ([id] → params.id). Catch-all segments are not used in AdminOS. */
export type RouteParams = Record<string, string>

export interface HandlerArgs<C, B, Q> {
  request: Request
  ctx: C
  body: B
  query: Q
  params: RouteParams
  /** Write an audit entry now (awaited; failures logged, not thrown). */
  audit(entry: AuditInput): Promise<void>
}

export type Segment = { params: Promise<RouteParams> }

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function zodFields(issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey>; message: string }>) {
  const fields: Record<string, string> = {}
  for (const issue of issues) {
    const key = issue.path.map(String).join('.') || '_'
    fields[key] ??= issue.message
  }
  return fields
}

// ─── Factory ────────────────────────────────────────────────────────────────

export function createRouteFactory<C extends BaseContext>(deps: RouteDeps<C>) {
  return function withRoute<
    B extends ZodType | undefined = undefined,
    Q extends ZodType | undefined = undefined,
  >(
    config: RouteConfig<B, Q>,
    handler: (args: HandlerArgs<C, Out<B>, Out<Q>>) => Promise<unknown>,
  ) {
    // segment must be required: Next's build-time route validator rejects an
    // optional second argument ("Expected RouteContext, got Segment | undefined").
    return async function route(request: Request, segment: Segment): Promise<Response> {
      let ctx: C | null = null
      try {
        // 1. Identity + tenant. Same 401 for every failure mode — telling a
        //    prober whether a tenant exists is free reconnaissance.
        ctx = await deps.getContext()
        if (!ctx) return json(401, { error: 'Not authorised', code: 'unauthenticated' })

        // 2. Role, via the matrix.
        if (!deps.authorize(ctx, config.action)) {
          return json(403, { error: 'You do not have permission to do this.', code: 'forbidden' })
        }

        // 3. Rate limit (per tenant).
        if (config.rateLimit && deps.rateLimit) {
          const ok = await deps.rateLimit(config.rateLimit, ctx.tenantId)
          if (!ok) return json(429, { error: 'Too many requests. Please slow down.', code: 'rate_limited' })
        }

        // 4. Input.
        const params: RouteParams = (await segment.params) ?? {}

        let query = undefined as Out<Q>
        if (config.query) {
          const raw = Object.fromEntries(new URL(request.url).searchParams)
          const parsed = config.query.safeParse(raw)
          if (!parsed.success) {
            return json(400, { error: 'Invalid request', code: 'invalid_query', fields: zodFields(parsed.error.issues) })
          }
          query = parsed.data as Out<Q>
        }

        let body = undefined as Out<B>
        if (config.body) {
          let raw: unknown
          try {
            raw = await request.json()
          } catch {
            return json(400, { error: 'Request body must be valid JSON.', code: 'invalid_json' })
          }
          const parsed = config.body.safeParse(raw)
          if (!parsed.success) {
            return json(400, { error: 'Please check the highlighted fields.', code: 'invalid_body', fields: zodFields(parsed.error.issues) })
          }
          body = parsed.data as Out<B>
        }

        // 5. The route's own work.
        const caller = ctx
        const result = await handler({
          request,
          ctx: caller,
          body,
          query,
          params,
          audit: (entry) => deps.audit(caller, entry, request),
        })

        // 6. Audit on success — a handler that returned its own error Response
        //    did nothing worth recording.
        const succeeded = !(result instanceof Response) || result.ok
        if (config.audit && succeeded) {
          const resultId = (result as { id?: unknown } | null)?.id
          await deps.audit(caller, {
            action: config.audit,
            resourceType: config.resourceType,
            resourceId: typeof resultId === 'string' ? resultId : params.id,
          }, request)
        }

        if (result instanceof Response) return result
        return json(config.status ?? 200, result ?? { ok: true })
      } catch (e) {
        const [status, body, report] = mapError(e)
        if (report) {
          try {
            await deps.report(e, {
              action: config.action,
              method: request.method,
              path: new URL(request.url).pathname,
              tenantId: ctx?.tenantId,
              userId: ctx?.userId,
            })
          } catch { /* reporting must never mask the response */ }
        }
        return json(status, body)
      }
    }
  }
}
