/**
 * guard() — the role check for routes not (yet) on withRoute.
 *
 *   export async function GET() {
 *     const g = await guard('contacts.read'); if (g.denied) return g.denied
 *     …
 *
 * Same identity resolution (getContext: app_metadata tenant, fail-closed) and
 * the same 401/403 bodies as withRoute, decided by the same role matrix. It
 * exists because the legacy routes checked a permission on their writes but
 * not on their reads — and the quality scan counted the whole file as checked.
 * Moving a route fully onto withRoute remains the goal; this closes the hole
 * without changing any response shape the callers rely on.
 */
import { NextResponse } from 'next/server'
import { getContext, type Context } from '@/lib/auth/context'
import { can, type Action } from '@/lib/auth/roleMatrix'
import { mapError } from '@/lib/api/handler'

export type Guarded = { ctx: Context; denied?: undefined } | { ctx?: undefined; denied: NextResponse }

export async function guard(action: Action): Promise<Guarded> {
  const ctx = await getContext()
  if (!ctx) return { denied: NextResponse.json({ error: 'Not authorised', code: 'unauthenticated' }, { status: 401 }) }
  if (!can(ctx, action)) {
    return { denied: NextResponse.json({ error: 'You do not have permission to do this.', code: 'forbidden' }, { status: 403 }) }
  }
  return { ctx }
}

/**
 * The legacy-route twin of withRoute's error mapping: log the real database
 * error server-side, send the user the same friendly message withRoute would
 * ("That already exists", "Something went wrong…") — never Postgres's own text,
 * which names tables, columns and constraints.
 */
export function dbError(error: unknown): NextResponse {
  const [status, body, report] = mapError(error)
  if (report) console.error('[route] database error', error)
  return NextResponse.json(body, { status })
}
