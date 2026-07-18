/**
 * Add-ons — the single source of truth for what a tenant is entitled to.
 *
 * Canonical set = the five add-ons with live Paystack plans. Everything (checkout,
 * the paystack webhook, feature gates, the billing page, the operator editor)
 * resolves entitlement through here so the three-way drift that used to exist —
 * paid flow vs display catalogue vs gate table — cannot come back.
 *
 * Entitlement (pure rule in ./addonLogic, unit-tested):
 *   1. Paid       → subscriptions.addon_<slug> = true (set by the Paystack
 *      webhook), still within addon_<slug>_expires_at.
 *   2. Bundled    → plan_catalogue.included_addons contains the slug (the tier
 *      ladder that drives upgrades).
 *
 * Prices, names and the bundle map live in the DB (addon_catalogue /
 * plan_catalogue), editable from the operator console — never hardcode a price.
 */

import { supabaseAdmin } from '@/lib/supabase/admin'
import { ADDON_SLUGS, resolveEntitledAddons, type AddonSlug } from '@/lib/billing/addonLogic'

export { ADDON_SLUGS, isAddonSlug, addonColumn, addonPlanEnv, type AddonSlug } from '@/lib/billing/addonLogic'

/**
 * Every add-on a tenant is currently entitled to — paid (active, unexpired) plus
 * whatever their plan bundles. The one function gates and UI should use.
 */
export async function getEffectiveAddons(tenantId: string): Promise<AddonSlug[]> {
  const [tenantRes, subRes] = await Promise.all([
    supabaseAdmin.from('tenants').select('plan').eq('id', tenantId).maybeSingle(),
    // Read the tenant's single subscription row REGARDLESS of status. Add-on
    // entitlement is the addon_<slug> boolean + its expiry (set by the Paystack
    // webhook), NOT the overall subscription.status — a tenant can buy an add-on
    // while still on the trial plan, whose row is status='trialing'. Filtering on
    // status='active' here dropped those and denied access to paying customers.
    // One row per tenant (all upserts use onConflict: 'tenant_id').
    supabaseAdmin.from('subscriptions').select('*').eq('tenant_id', tenantId).maybeSingle(),
  ])

  let includedByPlan: string[] = []
  const plan = tenantRes.data?.plan as string | undefined
  if (plan) {
    const { data: pc } = await supabaseAdmin
      .from('plan_catalogue')
      .select('included_addons')
      .eq('slug', plan)
      .maybeSingle()
    includedByPlan = (pc?.included_addons ?? []) as string[]
  }

  return resolveEntitledAddons(includedByPlan, subRes.data as Record<string, unknown> | null, Date.now())
}

/** Whether a tenant is entitled to one add-on (paid or bundled). */
export async function tenantHasAddon(tenantId: string, slug: AddonSlug): Promise<boolean> {
  return (await getEffectiveAddons(tenantId)).includes(slug)
}
