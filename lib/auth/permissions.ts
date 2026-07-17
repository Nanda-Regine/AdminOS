/**
 * Role & Permission System — Phase 0.6
 *
 * Defines all permissions in AdminOS, maps them to default roles,
 * and provides enforcement functions for API routes.
 *
 * Usage in an API route:
 *   const allowed = await checkPermission('approve_leave')
 *   if (!allowed) return new NextResponse('Forbidden', { status: 403 })
 *
 * Or throw-style:
 *   await requirePermission('manage_billing')
 */

import { supabaseAdmin } from '@/lib/supabase/admin'
import { createClient }  from '@/lib/supabase/server'

// ─── Permission types ─────────────────────────────────────────────────────────

export type Permission =
  | 'manage_staff'
  | 'view_financials'
  | 'approve_leave'
  | 'view_payroll'
  | 'manage_settings'
  | 'manage_billing'
  | 'view_analytics'
  | 'send_broadcasts'
  | 'manage_invoices'
  | 'manage_contacts'
  | 'manage_documents'
  | 'manage_inventory'
  | 'view_own_data_only'

export type RoleName = 'owner' | 'admin' | 'manager' | 'staff' | 'field_agent' | 'client'

export const ALL_PERMISSIONS: Permission[] = [
  'manage_staff',
  'view_financials',
  'approve_leave',
  'view_payroll',
  'manage_settings',
  'manage_billing',
  'view_analytics',
  'send_broadcasts',
  'manage_invoices',
  'manage_contacts',
  'manage_documents',
  'manage_inventory',
  'view_own_data_only',
]

// ─── Default role permission sets ────────────────────────────────────────────

export const DEFAULT_ROLE_PERMISSIONS: Record<RoleName, Permission[]> = {
  owner: [
    'manage_staff', 'view_financials', 'approve_leave', 'view_payroll',
    'manage_settings', 'manage_billing', 'view_analytics', 'send_broadcasts',
    'manage_invoices', 'manage_contacts', 'manage_documents', 'manage_inventory',
  ],
  admin: [
    'manage_staff', 'view_financials', 'approve_leave', 'view_payroll',
    'manage_settings', 'view_analytics', 'send_broadcasts',
    'manage_invoices', 'manage_contacts', 'manage_documents', 'manage_inventory',
  ],
  manager: [
    'view_financials', 'approve_leave', 'view_analytics',
    'manage_invoices', 'manage_contacts', 'manage_documents', 'manage_inventory',
  ],
  staff: [
    'manage_contacts', 'manage_documents', 'view_own_data_only',
  ],
  field_agent: [
    'manage_contacts', 'view_own_data_only',
  ],
  client: [
    'view_own_data_only',
  ],
}

// ─── Errors ───────────────────────────────────────────────────────────────────

export class PermissionError extends Error {
  constructor(public readonly permission: Permission) {
    super(`Forbidden: ${permission} permission required`)
    this.name = 'PermissionError'
  }
}

// ─── Core lookup ─────────────────────────────────────────────────────────────

/**
 * Role and permissions for this user *within this tenant*, from the user_roles
 * table. Returns null when no role is assigned.
 *
 * The tenant_id filter is the control that makes a spoofed tenant useless:
 * holding a tenant you were never granted returns no row here. Callers MUST
 * treat null as "deny" — see checkPermission.
 */
export async function getUserPermissions(
  userId: string,
  tenantId: string
): Promise<{ role: string; permissions: Permission[] } | null> {
  const { data, error } = await supabaseAdmin
    .from('user_roles')
    .select(`
      roles (
        name,
        permissions
      )
    `)
    .eq('user_id', userId)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  // A transport error is not proof of absence, but it is not proof of presence
  // either — and only one of those is safe to assume.
  if (error || !data?.roles) return null
  const role = data.roles as unknown as { name: string; permissions: string[] }
  return {
    role:        role.name,
    permissions: (role.permissions ?? []) as Permission[],
  }
}

// ─── Enforcement functions ────────────────────────────────────────────────────

/**
 * Check if the currently authenticated user has the given permission
 * within their tenant. Returns true/false — does not throw.
 *
 * Fails closed at every step. This function used to end with
 *
 *     if (!userPerms) return true   // No role record = legacy owner — allow all
 *
 * which inverted its own purpose: spoofing a tenant you had no role in returns
 * no role record, so the check that should have caught the attack granted
 * owner-equivalent access instead. If a caller has no role here, they get
 * nothing. Seed roles with seedDefaultRoles() at tenant creation rather than
 * inferring ownership from absence.
 */
export async function checkPermission(permission: Permission): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  // app_metadata, never user_metadata — the user can rewrite the latter, which
  // would make the tenant filter below attacker-controlled.
  const tenantId = user.app_metadata?.tenant_id as string | undefined
  if (!tenantId) return false

  const userPerms = await getUserPermissions(user.id, tenantId)
  if (!userPerms) return false

  return userPerms.permissions.includes(permission)
}

/**
 * Require a permission — throws PermissionError if not granted.
 * Use in API routes where access must be gated.
 */
export async function requirePermission(permission: Permission): Promise<void> {
  if (!(await checkPermission(permission))) {
    throw new PermissionError(permission)
  }
}

/**
 * Seed all default system roles for a newly created tenant.
 * Called from the onboarding Inngest function after tenant creation.
 */
export async function seedDefaultRoles(tenantId: string): Promise<void> {
  const rows = (Object.entries(DEFAULT_ROLE_PERMISSIONS) as [RoleName, Permission[]][]).map(
    ([name, permissions]) => ({
      tenant_id:   tenantId,
      name,
      permissions,
      is_system:   true,
    })
  )

  await supabaseAdmin
    .from('roles')
    .upsert(rows, { onConflict: 'tenant_id, name', ignoreDuplicates: true })
}

/**
 * Assign a role to a user within a tenant.
 * The role must already exist in the roles table.
 */
export async function assignRole(params: {
  userId:    string
  tenantId:  string
  roleName:  RoleName
  assignedBy?: string
}): Promise<void> {
  const { userId, tenantId, roleName, assignedBy } = params

  const { data: role } = await supabaseAdmin
    .from('roles')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('name', roleName)
    .single()

  if (!role) throw new Error(`Role '${roleName}' not found for tenant ${tenantId}`)

  await supabaseAdmin
    .from('user_roles')
    .upsert({
      user_id:     userId,
      tenant_id:   tenantId,
      role_id:     role.id,
      assigned_by: assignedBy ?? null,
    }, { onConflict: 'user_id, tenant_id' })
}
