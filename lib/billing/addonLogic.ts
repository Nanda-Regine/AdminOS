/**
 * Pure add-on logic — no imports, no I/O — so it can be unit-tested in isolation
 * (node --experimental-strip-types --test) without pulling the Supabase graph.
 * The DB-querying wrappers live in ./addons.ts and call resolveEntitledAddons.
 */

export const ADDON_SLUGS = ['ring', 'reach', 'languages', 'client_portal'] as const
export type AddonSlug = (typeof ADDON_SLUGS)[number]

export function isAddonSlug(s: string): s is AddonSlug {
  return (ADDON_SLUGS as readonly string[]).includes(s)
}

/** The subscriptions boolean column the Paystack webhook flips on payment. */
export const addonColumn = (s: AddonSlug) => `addon_${s}` as const
/** The env var holding this add-on's live Paystack plan code (hub-side). */
export const addonPlanEnv = (s: AddonSlug) => `PAYSTACK_PLAN_ADMINOS_${s.toUpperCase()}`

/**
 * Resolve every add-on a tenant is entitled to, from already-fetched inputs:
 *   - includedByPlan: the plan's included_addons (bundle ladder)
 *   - sub: the active subscription row (or null), carrying addon_<slug> booleans
 *          and addon_<slug>_expires_at timestamps
 *   - now: current epoch ms (injected for deterministic tests)
 *
 * A tenant has an add-on if their plan bundles it OR they paid for it and it has
 * not expired. Pure and deterministic — the single rule both the gate and the UI
 * depend on.
 */
export function resolveEntitledAddons(
  includedByPlan: readonly string[] | null | undefined,
  sub: Record<string, unknown> | null | undefined,
  now: number,
): AddonSlug[] {
  const entitled = new Set<AddonSlug>()

  for (const s of includedByPlan ?? []) {
    if (isAddonSlug(s)) entitled.add(s)
  }

  if (sub) {
    for (const s of ADDON_SLUGS) {
      if (sub[`addon_${s}`] === true) {
        const exp = sub[`addon_${s}_expires_at`] as string | null | undefined
        if (!exp || new Date(exp).getTime() > now) entitled.add(s)
      }
    }
  }

  return [...entitled]
}
