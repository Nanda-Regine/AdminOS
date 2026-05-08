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

const PLAN_LIMITS: Record<string, number> = {
  trial:       50,
  starter:     500,
  growth:      2000,
  enterprise:  Infinity,
  white_label: Infinity,
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
