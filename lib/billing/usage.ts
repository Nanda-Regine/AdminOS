import { Redis } from '@upstash/redis'

let _redis: Redis | null = null

function getRedis(): Redis {
  if (!_redis) {
    _redis = new Redis({
      url:   process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  }
  return _redis
}

// Monthly AI-conversation limits. Keyed by the CANONICAL plan names the app
// actually stores (solo/grow/operate/scale/partner) — these match the landing
// page's advertised numbers. Legacy names are kept as aliases so old rows still
// resolve. (Bug fixed: this map used only legacy names, so every real plan fell
// through to trial=50 — including Scale, which is meant to be unlimited.)
const PLAN_LIMITS: Record<string, number> = {
  trial:       50,
  solo:        100,      starter:     100,      // Solo — 100/mo
  grow:        500,      growth:      500,      // Grow — 500/mo
  operate:     2000,     business:    2000,     // Operate — 2,000/mo
  scale:       Infinity, enterprise:  Infinity, // Scale — unlimited
  partner:     Infinity, white_label: Infinity, // Partner — unlimited
}

function usageKey(tenantId: string): string {
  const ym = new Date().toISOString().slice(0, 7) // "YYYY-MM"
  return `usage:${tenantId}:conversations:${ym}`
}

/** Increment conversation counter and return current count */
export async function incrementUsage(tenantId: string): Promise<number> {
  const redis = getRedis()
  const key   = usageKey(tenantId)
  const count = await redis.incr(key)
  // Expire key 35 days after first write (covers full month + buffer)
  if (count === 1) await redis.expire(key, 60 * 60 * 24 * 35)
  return count
}

/** Return current usage count without incrementing */
export async function getUsage(tenantId: string): Promise<number> {
  const redis = getRedis()
  const val   = await redis.get<number>(usageKey(tenantId))
  return val ?? 0
}

/** Return plan limit for the given plan string */
export function getPlanLimit(plan: string): number {
  return PLAN_LIMITS[plan] ?? PLAN_LIMITS.trial
}

/**
 * Check if tenant has exceeded their monthly conversation limit.
 * Returns true (blocked) when over limit.
 */
export async function isOverLimit(tenantId: string, plan: string): Promise<boolean> {
  const limit = getPlanLimit(plan)
  if (!isFinite(limit)) return false
  const count = await getUsage(tenantId)
  return count >= limit
}
