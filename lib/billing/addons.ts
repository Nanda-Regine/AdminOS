/**
 * Add-ons — the single source of truth for what a tenant is entitled to.
 *
 * Canonical set = the five add-ons that have live Paystack plans. Everything
 * (checkout, the paystack webhook, feature gates, the billing page, the operator
 * editor) resolves entitlement through here so the three-way drift that used to
 * exist — paid flow vs display catalogue vs gate table — cannot come back.
 *
 * Two ways a tenant is entitled to an add-on:
 *   1. They paid for it       → subscriptions.addon_<slug> = true (set by the
 *      Paystack webhook), still within addon_<slug>_expires_at.
 *   2. Their plan bundles it  → plan_catalogue.included_addons contains the slug
 *      (the tier ladder that drives upgrades).
 *
 * Prices, names and the bundle map live in the DB (addon_catalogue /
 * plan_catalogue) and are editable from the operator console — never hardcode a
 * price in code again.
 */

import { supabaseAdmin } from '@/lib/supabase/admin'

export const ADDON_SLUGS = ['ring', 'reach', 'sage', 'languages', 'client_portal'] as const
export type AddonSlug = (typeof ADDON_SLUGS)[number]

export function isAddonSlug(s: string): s is AddonSlug {
  return (ADDON_SLUGS as readonly string[]).includes(s)
}

/** The subscriptions boolean column that the Paystack webhook flips on payment. */
export const addonColumn = (s: AddonSlug) => `addon_${s}` as const
/** The env var holding this add-on's live Paystack plan code (hub-side). */
export const addonPlanEnv = (s: AddonSlug) => `PAYSTACK_PLAN_ADMINOS_${s.toUpperCase()}`

/**
 * Every add-on a tenant is currently entitled to — paid (active, unexpired) plus
 * whatever their plan bundles. This is the one function gates and UI should use.
 */
export async function getEffectiveAddons(tenantId: string): Promise<AddonSlug[]> {
  const [tenantRes, subRes] = await Promise.all([
    supabaseAdmin.from('tenants').select('plan').eq('id', tenantId).maybeSingle(),
    supabaseAdmin.from('subscriptions').select('*').eq('tenant_id', tenantId).eq('status', 'active').maybeSingle(),
  ])

  const entitled = new Set<AddonSlug>()

  // 1. Bundled by plan
  const plan = tenantRes.data?.plan as string | undefined
  if (plan) {
    const { data: pc } = await supabaseAdmin
      .from('plan_catalogue')
      .select('included_addons')
      .eq('slug', plan)
      .maybeSingle()
    for (const s of (pc?.included_addons ?? []) as string[]) {
      if (isAddonSlug(s)) entitled.add(s)
    }
  }

  // 2. Paid, active and not expired
  const sub = subRes.data as Record<string, unknown> | null
  if (sub) {
    const now = Date.now()
    for (const s of ADDON_SLUGS) {
      if (sub[`addon_${s}`] === true) {
        const exp = sub[`addon_${s}_expires_at`] as string | null | undefined
        if (!exp || new Date(exp).getTime() > now) entitled.add(s)
      }
    }
  }

  return [...entitled]
}

/** Whether a tenant is entitled to one add-on (paid or bundled). */
export async function tenantHasAddon(tenantId: string, slug: AddonSlug): Promise<boolean> {
  return (await getEffectiveAddons(tenantId)).includes(slug)
}
