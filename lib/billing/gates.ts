import { createClient } from '@/lib/supabase/server'
import { tenantHasAddon } from '@/lib/billing/addons'
import type { AdminOSPlan } from '@/lib/billing/planGates'

// Plan tiers are the current pricing (solo → partner). Plan gating itself
// lives in lib/billing/planGates.ts, which reads tenants.plan. The old
// requirePlan/hasPlan here read user.app_metadata.plan against the retired
// trial/starter/growth/enterprise names and passed every real tenant; they
// had no callers and were removed (2026-10-06).
export type Plan = AdminOSPlan
export type Addon = 'ring' | 'reach' | 'languages' | 'client_portal'

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
