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

const FAQ_CACHE_TTL = 60 * 60 * 24 * 7  // 7 days
const DEDUP_TTL     = 60 * 60            // 1 hour
const SESSION_TTL   = 60 * 60 * 24      // 24 hours

// Normalise question text: lowercase, collapse whitespace, strip punctuation
function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function faqKey(tenantId: string, text: string): string {
  return `faq:${tenantId}:${normalise(text)}`
}

// ── FAQ Cache ──────────────────────────────────────────────────────────────────

export async function checkFAQCache(
  tenantId: string,
  text: string
): Promise<string | null> {
  try {
    return await getRedis().get<string>(faqKey(tenantId, text))
  } catch {
    return null
  }
}

export async function setFAQCache(
  tenantId: string,
  question: string,
  answer: string
): Promise<void> {
  try {
    await getRedis().set(faqKey(tenantId, question), answer, { ex: FAQ_CACHE_TTL })
  } catch {
    console.error('[FAQ Cache] set failed')
  }
}

export async function invalidateTenantFAQCache(tenantId: string): Promise<void> {
  try {
    const pattern = `faq:${tenantId}:*`
    let cursor = 0
    do {
      const [next, keys] = await getRedis().scan(cursor, { match: pattern, count: 100 })
      cursor = Number(next)
      if ((keys as string[]).length > 0) {
        await getRedis().del(...(keys as string[]))
      }
    } while (cursor !== 0)
  } catch {
    console.error('[FAQ Cache] invalidate failed')
  }
}

// ── WhatsApp deduplication ────────────────────────────────────────────────────

export async function checkDuplicate(messageId: string): Promise<boolean> {
  const key = `msg:${messageId}`
  try {
    // SET NX is atomic — returns null if key already existed
    const result = await getRedis().set(key, '1', { ex: DEDUP_TTL, nx: true })
    return result === null // null = key already existed = duplicate
  } catch {
    // If Redis is down, assume not duplicate to avoid dropping messages
    return false
  }
}

// ── Session / conversation context cache ─────────────────────────────────────

export async function getSessionData<T>(key: string): Promise<T | null> {
  try {
    return await getRedis().get<T>(`session:${key}`)
  } catch {
    return null
  }
}

export async function setSessionData(key: string, data: unknown): Promise<void> {
  try {
    await getRedis().set(`session:${key}`, JSON.stringify(data), { ex: SESSION_TTL })
  } catch {
    console.error('[Cache] setSessionData failed')
  }
}

// ── Tenant-level counters (for quota enforcement) ─────────────────────────────

export async function incrementTenantCounter(
  tenantId: string,
  metric: 'conversations' | 'ai_calls',
  windowSeconds = 60 * 60 * 24 * 30 // monthly
): Promise<number> {
  const key = `counter:${tenantId}:${metric}`
  try {
    const count = await getRedis().incr(key)
    if (count === 1) {
      // Set expiry only on first increment
      await getRedis().expire(key, windowSeconds)
    }
    return count
  } catch {
    return 0
  }
}

export async function getTenantCounter(
  tenantId: string,
  metric: 'conversations' | 'ai_calls'
): Promise<number> {
  try {
    return (await getRedis().get<number>(`counter:${tenantId}:${metric}`)) ?? 0
  } catch {
    return 0
  }
}
