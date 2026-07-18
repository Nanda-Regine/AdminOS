import { createClient } from '@/lib/supabase/server'
import { tenantHasAddon } from '@/lib/billing/addons'

export type Plan = 'trial' | 'starter' | 'growth' | 'enterprise' | 'white_label'
export type Addon = 'ring' | 'reach' | 'sage' | 'languages' | 'client_portal'

export class BillingError extends Error {
  constructor(
    message: string,
    public readonly code: 'plan_required' | 'addon_required' | 'trial_expired' | 'suspended',
    public readonly requiredPlan?: Plan,
    public readonly requiredAddon?: Addon,
  ) {
    super(message)
    this.name = 'BillingError'
  }
}

const PLAN_RANK: Record<Plan, number> = {
  trial: 0, starter: 1, growth: 2, enterprise: 3, white_label: 4,
}

/**
 * NOTE (Phase 0, 2026-07-17): currently unused — nothing imports requirePlan or
 * hasPlan; only requireAddon/hasAddon are live. Left in place but be aware the
 * Plan union here (trial/starter/growth/enterprise) is the OLD pricing and no
 * longer matches tenants.plan in the DB (solo/grow/operate/scale/partner). If
 * you wire this up, PLAN_RANK[plan] will be undefined for every real tenant and
 * the comparison below silently passes. Use planGates.requireAdminOSPlan()
 * instead — it reads the plan from the tenants table.
 */
export async function requirePlan(minPlan: Plan): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new BillingError('Unauthorized', 'plan_required', minPlan)

  // app_metadata, not user_metadata: the user can rewrite user_metadata and
  // would otherwise just grant themselves the top tier.
  const plan = (user.app_metadata?.plan ?? 'trial') as Plan
  if (PLAN_RANK[plan] < PLAN_RANK[minPlan]) {
    throw new BillingError(
      `This feature requires the ${minPlan} plan or higher.`,
      'plan_required',
      minPlan,
    )
  }
}

export async function requireAddon(addon: Addon): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new BillingError('Unauthorized', 'addon_required', undefined, addon)

  const tenantId = user.app_metadata?.tenant_id as string
  if (!tenantId) throw new BillingError('No tenant', 'addon_required', undefined, addon)

  // Entitlement = paid for it OR the plan bundles it. tenantHasAddon is the one
  // resolver (lib/billing/addons); do not re-derive it here. This is what makes
  // the tier ladder work: a Scale tenant passes the client_portal gate for free.
  if (!(await tenantHasAddon(tenantId, addon))) {
    throw new BillingError(
      `The ${addon} add-on is required for this feature.`,
      'addon_required',
      undefined,
      addon,
    )
  }
}

/** Check add-on without throwing — for UI gating */
export async function hasAddon(addon: Addon): Promise<boolean> {
  try {
    await requireAddon(addon)
    return true
  } catch {
    return false
  }
}

/** Check plan without throwing — for UI gating */
export async function hasPlan(minPlan: Plan): Promise<boolean> {
  try {
    await requirePlan(minPlan)
    return true
  } catch {
    return false
  }
}

/** Convert BillingError to a standard API response body */
export function billingErrorResponse(err: BillingError) {
  return {
    error:         err.message,
    code:          err.code,
    requiredPlan:  err.requiredPlan,
    requiredAddon: err.requiredAddon,
    upgradeUrl:    '/dashboard/settings/billing',
  }
}
