/**
 * Plan gates for the new AdminOS pricing structure:
 * solo → grow → operate → scale → partner
 *
 * New features use this file. Legacy features using the old names
 * (trial/starter/growth/enterprise) continue to use lib/billing/gates.ts
 * until migrated.
 */

import { createClient }  from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export type AdminOSPlan = 'solo' | 'grow' | 'operate' | 'scale' | 'partner'

export type AdminOSAddon =
  | 'whatsapp_extra'
  | 'ai_languages'
  | 'payroll_module'
  | 'booking_engine'
  | 'esignature'
  | 'social_inbox'
  | 'white_label'
  | 'extra_staff_5'

const PLAN_RANK: Record<AdminOSPlan, number> = {
  solo: 0, grow: 1, operate: 2, scale: 3, partner: 4,
}

export class PlanGateError extends Error {
  constructor(
    message: string,
    public readonly code: 'plan_required' | 'addon_required' | 'suspended',
    public readonly requiredPlan?: AdminOSPlan,
    public readonly requiredAddon?: AdminOSAddon,
  ) {
    super(message)
    this.name = 'PlanGateError'
  }
}

// ─── Plan checks ─────────────────────────────────────────────────────────────

/**
 * Get current tenant plan from DB (not from JWT — JWT can be stale after upgrade).
 * Falls back to 'solo' if no record.
 */
export async function getTenantPlan(tenantId: string): Promise<AdminOSPlan> {
  const { data } = await supabaseAdmin
    .from('tenants')
    .select('plan')
    .eq('id', tenantId)
    .single()
  return (data?.plan as AdminOSPlan) ?? 'solo'
}

export async function requireAdminOSPlan(minPlan: AdminOSPlan): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new PlanGateError('Unauthorized', 'plan_required', minPlan)

  const tenantId = user.app_metadata?.tenant_id as string
  if (!tenantId) throw new PlanGateError('No tenant', 'plan_required', minPlan)

  const plan = await getTenantPlan(tenantId)
  if (PLAN_RANK[plan] < PLAN_RANK[minPlan]) {
    throw new PlanGateError(
      `This feature requires the ${minPlan} plan or higher. You are on ${plan}.`,
      'plan_required',
      minPlan,
    )
  }
}

export async function hasAdminOSPlan(minPlan: AdminOSPlan): Promise<boolean> {
  try { await requireAdminOSPlan(minPlan); return true }
  catch { return false }
}

// ─── Add-on checks ───────────────────────────────────────────────────────────

export async function requireAdminOSAddon(addon: AdminOSAddon): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new PlanGateError('Unauthorized', 'addon_required', undefined, addon)

  const tenantId = user.app_metadata?.tenant_id as string
  if (!tenantId) throw new PlanGateError('No tenant', 'addon_required', undefined, addon)

  const { data } = await supabaseAdmin
    .from('addon_subscriptions')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('addon_slug', addon)
    .eq('status', 'active')
    .maybeSingle()

  if (!data) {
    throw new PlanGateError(
      `The ${addon} add-on is required for this feature. Visit Settings > Billing to subscribe.`,
      'addon_required',
      undefined,
      addon,
    )
  }
}

export async function hasAdminOSAddon(addon: AdminOSAddon): Promise<boolean> {
  try { await requireAdminOSAddon(addon); return true }
  catch { return false }
}

/**
 * Get all active add-ons for a tenant.
 * Used for feature availability checks in the frontend.
 */
export async function getTenantAddons(tenantId: string): Promise<AdminOSAddon[]> {
  const { data } = await supabaseAdmin
    .from('addon_subscriptions')
    .select('addon_slug')
    .eq('tenant_id', tenantId)
    .eq('status', 'active')

  return (data ?? []).map(r => r.addon_slug as AdminOSAddon)
}

/** Convert PlanGateError to a standard API response */
export function planGateErrorResponse(err: PlanGateError) {
  return {
    error:         err.message,
    code:          err.code,
    requiredPlan:  err.requiredPlan,
    requiredAddon: err.requiredAddon,
    upgradeUrl:    '/dashboard/settings/billing',
  }
}
