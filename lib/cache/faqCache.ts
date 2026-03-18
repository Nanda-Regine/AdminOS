import { Redis } from '@upstash/redis'

const redis = Redis.fromEnv()

const FAQ_CACHE_TTL = 60 * 60 * 24 * 7 // 7 days

function buildKey(tenantId: string, text: string): string {
  // Normalize: lowercase, strip punctuation, trim whitespace
  const normalized = text.toLowerCase().replace(/[^\w\s]/g, '').trim()
  return `faq:${tenantId}:${normalized}`
}

export async function checkFAQCache(tenantId: string, text: string): Promise<string | null> {
  try {
    const key = buildKey(tenantId, text)
    return await redis.get<string>(key)
  } catch {
    return null
  }
}

export async function setFAQCache(tenantId: string, question: string, answer: string): Promise<void> {
  try {
    const key = buildKey(tenantId, question)
    await redis.set(key, answer, { ex: FAQ_CACHE_TTL })
  } catch {
    // Non-critical — log and continue
    console.error('[FAQ Cache] Failed to set cache')
  }
}

export async function invalidateTenantFAQCache(tenantId: string): Promise<void> {
  try {
    const pattern = `faq:${tenantId}:*`
    let cursor = 0
    do {
      const [nextCursor, keys] = await redis.scan(cursor, { match: pattern, count: 100 })
      cursor = nextCursor
      if (keys.length > 0) {
        await redis.del(...keys)
      }
    } while (cursor !== 0)
  } catch {
    console.error('[FAQ Cache] Failed to invalidate tenant cache')
  }
}

// Session deduplication for WhatsApp
export async function checkDuplicate(messageId: string): Promise<boolean> {
  const key = `msg:${messageId}`
  const exists = await redis.get(key)
  if (exists) return true
  await redis.set(key, '1', { ex: 3600 })
  return false
}
