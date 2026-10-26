/**
 * When to OFFER the owner more autonomy — never to grant it. Pure (no imports)
 * so tests load it directly.
 *
 * Money-moving actions start at tier B (AdminOS proposes, the owner confirms).
 * After the owner has confirmed enough of the matches AdminOS was sure about,
 * with none of them undone, it is reasonable to ASK whether to settle those
 * automatically. The owner still chooses: a tier only ever changes when they
 * tap the button, and they can switch it back in Settings → Autonomy.
 */

export const GRADUATION_MIN_CONFIRMED = 10

export function graduationOffer(a: { tier: 'A' | 'B' | 'C'; confirmed: number; undone: number }): boolean {
  return a.tier === 'B' && a.confirmed >= GRADUATION_MIN_CONFIRMED && a.undone === 0
}
