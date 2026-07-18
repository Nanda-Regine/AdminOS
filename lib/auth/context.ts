/**
 * The one door — Phase 0 of WORKSPACE_ARCHITECTURE.md §4.
 *
 * Every authenticated read and write should resolve identity through here:
 *
 *     const ctx = await requireContext()
 *     const { data } = await ctx.db.from('invoices').select('*')   // RLS scopes it
 *
 * Why this file exists: AdminOS answered "who am I, what tenant am I, am I
 * allowed" by hand in ~148 places, and 148 hand-written answers to a security
 * question produced 148 chances to be wrong. They were wrong. This is that
 * answer once — right once or wrong once, in a file small enough to hold in
 * your head.
 *
 * Three rules, all load-bearing:
 *
 *  1. Tenant comes from `app_metadata`, never `user_metadata`. The user owns
 *     user_metadata and can rewrite it (`supabase.auth.updateUser`), so a
 *     tenant_id read from there is an attacker-supplied value.
 *
 *  2. It fails closed. No user, no tenant, no role record → no access. The
 *     previous permission check did the opposite (`if (!userPerms) return true`)
 *     which meant spoofing a tenant you had no role in granted owner-equivalent
 *     access — the one control that could have caught the attack rewarded it.
 *
 *  3. `ctx.db` is the RLS-respecting client. Reach for `supabaseAdmin` only
 *     where you genuinely must cross tenants (cron, webhooks, admin), and know
 *     that you are then hand-rolling the tenant filter with no safety net.
 */

import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  type Permission,
  type RoleName,
  PermissionError,
  getUserPermissions,
} from '@/lib/auth/permissions'

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly reason: 'unauthenticated' | 'no_tenant' | 'no_role' | 'suspended',
  ) {
    super(message)
    this.name = 'AuthError'
  }
}

export interface Context {
  userId: string
  tenantId: string
  role: RoleName
  permissions: Permission[]
  isSuperAdmin: boolean
  /** RLS-respecting client, already scoped to this user's tenant by policy. */
  db: SupabaseClient
  has(permission: Permission): boolean
  /** Throws PermissionError when the permission is absent. */
  require(permission: Permission): void
}

/**
 * Resolve the caller's verified context, or null if they have none.
 *
 * Returns null rather than throwing so callers can branch (e.g. render a
 * logged-out view). Use `requireContext()` when absence is an error — which is
 * almost everywhere.
 */
export async function getContext(): Promise<Context | null> {
  const supabase = await createClient()

  // getUser() re-validates the JWT against Supabase — do not swap this for
  // getSession(), which trusts the cookie without verifying the signature.
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // app_metadata only. See rule 1 above.
  const tenantId = user.app_metadata?.tenant_id as string | undefined
  if (!tenantId) return null

  if (user.app_metadata?.suspended === true) return null

  const isSuperAdmin = await checkSuperAdmin(user.id)

  // Role comes from user_roles filtered by tenant — holding a tenant_id you
  // were never granted returns no row, which is what makes a spoof useless.
  const assigned = await getUserPermissions(user.id, tenantId)

  // Fail closed. A user with no role record in this tenant has no business
  // here — most likely they are holding a tenant_id they were never granted.
  // Super-admins are the one exception, verified against the admins table
  // (20260612_admins_table.sql), never against a JWT claim.
  if (!assigned && !isSuperAdmin) return null

  const role = (assigned?.role ?? 'owner') as RoleName
  const permissions = assigned?.permissions ?? []

  return {
    userId: user.id,
    tenantId,
    role,
    permissions,
    isSuperAdmin,
    db: supabase,
    has(permission) {
      return isSuperAdmin || permissions.includes(permission)
    },
    require(permission) {
      // Do not call this.has() — inside an object-literal method `this` widens to
      // Context | PromiseLike<Context>, which won't type. Close over the locals.
      if (!(isSuperAdmin || permissions.includes(permission))) throw new PermissionError(permission)
    },
  }
}

/**
 * Resolve the caller's verified context, throwing AuthError if they have none.
 *
 * The thrown reason distinguishes the failure modes for logging, but callers
 * should render the same 401/403 to the user either way — telling an attacker
 * whether a tenant exists is free reconnaissance.
 */
export async function requireContext(): Promise<Context> {
  const ctx = await getContext()
  if (!ctx) throw new AuthError('Not authorised', 'unauthenticated')
  return ctx
}

/**
 * The single super-admin gate for operator/admin surfaces.
 *
 * Verifies the caller against the `admins` table — never a JWT claim — and,
 * unlike getContext(), does NOT require a tenant: a platform operator may have
 * no tenant of their own. Returns the user when they are a super-admin, else
 * null. API routes should render 403; pages should notFound() (invisible, not
 * merely forbidden — do not confirm the surface exists to someone probing).
 *
 * This replaces the ~5 hand-copied admins-table checks across /api/admin/* and
 * the `x-operator-secret` header model in /operator — one definition of
 * "operator", verified per request.
 */
export async function requireSuperAdmin(): Promise<{ id: string; email: string | null } | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const ok = await checkSuperAdmin(user.id)
  return ok ? { id: user.id, email: user.email ?? null } : null
}

// ─── Internals ───────────────────────────────────────────────────────────────

/** Super-admin comes from the admins table, never from a JWT claim. */
async function checkSuperAdmin(userId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('admins')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) return false
  return Boolean(data)
}
