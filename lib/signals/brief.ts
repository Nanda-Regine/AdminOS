/**
 * Daily brief store. The `dailyBrief` Inngest worker already writes a full
 * Langa-authored morning brief every day — but only into audit_log, where the
 * owner never sees it. This caches the latest brief per tenant so the Command
 * Center can surface it (Law 2: "if data exists, it's already been read").
 */

import { Redis } from '@upstash/redis'
import type { Watchout } from '@/lib/brief/watchouts'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

export interface DailyBrief {
  /** Langa's narrative. Empty when the AI budget deferred it — the watch-outs below are still shown. */
  text: string
  generatedAt: string
  /** The top money risks this week, computed from the forecast and invoices (lib/brief/watchouts.ts), each with its own link. */
  watchouts?: Watchout[]
}

const key = (tenantId: string) => `adminos:brief:${tenantId}`
const TTL = 60 * 60 * 30 // 30h — survives a missed morning run

export async function setDailyBrief(tenantId: string, text: string, watchouts: Watchout[] = []): Promise<void> {
  try {
    await redis.set(key(tenantId), { text, generatedAt: new Date().toISOString(), watchouts } satisfies DailyBrief, { ex: TTL })
  } catch {
    /* best-effort cache */
  }
}

export async function getDailyBrief(tenantId: string): Promise<DailyBrief | null> {
  try {
    return (await redis.get(key(tenantId))) as DailyBrief | null
  } catch {
    return null
  }
}
