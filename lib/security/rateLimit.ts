import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const redis = Redis.fromEnv()

export const rateLimiters = {
  // WhatsApp webhook: 100 req/10s per tenant
  whatsapp: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(100, '10 s'),
    prefix: 'rl:wa',
  }),
  // API routes: 60 req/min per tenant
  api: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(60, '60 s'),
    prefix: 'rl:api',
  }),
  // AI agents: 20 req/min per tenant
  agents: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, '60 s'),
    prefix: 'rl:agent',
  }),
}

export async function checkRateLimit(
  limiterKey: keyof typeof rateLimiters,
  tenantId: string
): Promise<{ success: boolean; remaining: number; reset: number }> {
  const { success, remaining, reset } = await rateLimiters[limiterKey].limit(tenantId)
  return { success, remaining, reset }
}
