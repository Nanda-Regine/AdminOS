/**
 * staff.wellness_scores is a JSON array of `{ score, date }` (written by
 * lib/workflow/engine.ts and lib/workflows/wellness.ts). Some readers treated
 * it as `number[]` and summed objects — the People cockpit and daily brief
 * showed NaN. Read it only through here. Accepts bare numbers too, for any
 * legacy rows.
 *
 * Pure, no imports (unit-tested directly).
 */
export function wellnessValues(raw: unknown): number[] {
  if (!Array.isArray(raw)) return []
  const out: number[] = []
  for (const entry of raw) {
    const v = typeof entry === 'number' ? entry : Number((entry as { score?: unknown } | null)?.score)
    if (Number.isFinite(v)) out.push(v)
  }
  return out
}

/** Average of the most recent `n` scores, or null when there are none. */
export function recentWellnessAvg(raw: unknown, n = 7): number | null {
  const recent = wellnessValues(raw).slice(-n)
  return recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length : null
}
