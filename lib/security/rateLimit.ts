import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

let _redis: Redis | null = null

function getRedis(): Redis {
  if (!_redis) {
    _redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  }
  return _redis
}

type LimiterKey = 'whatsapp' | 'api' | 'agents' | 'webhook' | 'onboarding'

// Sliding window limits per tenant
const limiterConfigs: Record<LimiterKey, { window: string; max: number; prefix: string }> = {
  whatsapp:   { window: '10 s',  max: 30,  prefix: 'rl:wa' },     // 30 msgs / 10s per tenant
  api:        { window: '60 s',  max: 60,  prefix: 'rl:api' },    // 1 req/s average
  agents:     { window: '60 s',  max: 20,  prefix: 'rl:agent' },  // AI agents — more expensive
  webhook:    { window: '1 s',   max: 100, prefix: 'rl:wh' },     // High-volume inbound
  onboarding: { window: '3600 s',max: 10,  prefix: 'rl:onb' },   // Prevent signup abuse
}

// Singleton limiter instances to avoid recreating per request
const limiterCache: Partial<Record<LimiterKey, Ratelimit>> = {}

function getLimiter(key: LimiterKey): Ratelimit {
  if (!limiterCache[key]) {
    const cfg = limiterConfigs[key]
    limiterCache[key] = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(
        cfg.max,
        cfg.window as Parameters<typeof Ratelimit.slidingWindow>[1]
      ),
      prefix: cfg.prefix,
      analytics: true, // Track hit rates in Upstash console
    })
  }
  return limiterCache[key]!
}

export async function checkRateLimit(
  limiterKey: LimiterKey,
  identifier: string // tenantId or IP
): Promise<{ success: boolean; remaining: number; reset: number }> {
  try {
    const limiter = getLimiter(limiterKey)
    const { success, remaining, reset } = await limiter.limit(identifier)
    return { success, remaining, reset }
  } catch {
    // If Redis is unavailable, fail open to not block production traffic
    // Log the failure but allow the request through
    console.error('[RateLimit] Redis unavailable — failing open')
    return { success: true, remaining: 0, reset: 0 }
  }
}

export function getRateLimitHeaders(result: {
  remaining: number
  reset: number
}): Record<string, string> {
  return {
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': new Date(result.reset).toUTCString(),
  }
}
