/**
 * THE SIGNAL BUS — AdminOS nervous system.
 *
 * Every domain publishes its current, at-a-glance state to Redis under
 * `adminos:signal:{domain}:{tenantId}`. The Command Center and cross-domain
 * automations READ these instead of re-querying every table — so the business
 * behaves as one system, not a set of pages. (Ported from the JarvisOS
 * `jarvis:signals:{wing}:{userId}` pattern, adapted to multi-tenant + Upstash.)
 *
 * Laws:
 *  - A signal is a small, denormalised snapshot — the "vital sign" of a domain.
 *  - Signals are refreshed by the domain's Inngest workers (autonomous rhythm)
 *    and opportunistically on read paths; they are a cache, never the source of
 *    truth. TTL keeps them fresh; a missing signal degrades gracefully to null.
 *  - Consumers must tolerate a null/stale signal (fall back to a live query).
 */

import { Redis } from '@upstash/redis'
import { supabaseAdmin } from '@/lib/supabase/admin'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

export type Domain = 'money' | 'sales' | 'ops' | 'people' | 'governance'

/** Traffic-light health used across every signal + the scorecard. */
export type Health = 'good' | 'watch' | 'bad'

/** Money / cash-conversion-cycle signal. `mode` drives cross-domain cascades. */
export interface MoneySignal {
  mode: 'BUILD' | 'STEADY' | 'PROTECT' // PROTECT = hold discretionary spend
  arTotal: number        // owed to you (outstanding)
  arOverdue: number      // overdue portion
  arStuck: number        // > 60 days — the constraint
  apTotal: number        // you owe (unpaid, non-rejected)
  netPosition: number    // AR − AP
  runwayMonths: number | null
  recoveryReview: number // escalations awaiting owner decision
  health: Health
}

export interface SalesSignal {
  openConversations: number
  needAttention: number  // negative / urgent sentiment
  pipelineValue: number  // sum of open/quoted invoices not yet paid
  health: Health
}

export interface OpsSignal {
  lowStock: number
  stockoutRisk: string[] // product names at/below reorder
  bookingsToday: number
  pendingBookings: number
  overdueTasks: number
  health: Health
}

export interface PeopleSignal {
  activeStaff: number
  pendingLeave: number
  pendingExpenses: number
  wellnessAvg: number | null // 0–5, null if not tracked
  health: Health
}

export interface GovernanceSignal {
  complianceDue: number  // ≤14 days
  contractsExpiring: number
  contractsAwaiting: number
  health: Health
}

export interface SignalMap {
  money: MoneySignal
  sales: SalesSignal
  ops: OpsSignal
  people: PeopleSignal
  governance: GovernanceSignal
}

const TTL_SECONDS = 60 * 60 * 26 // 26h — survives a missed nightly refresh
const key = (domain: Domain, tenantId: string) => `adminos:signal:${domain}:${tenantId}`

/** Publish a domain's signal (called by workers + read paths after computing). */
export async function publishSignal<D extends Domain>(
  domain: D,
  tenantId: string,
  signal: SignalMap[D],
): Promise<void> {
  try {
    await redis.set(key(domain, tenantId), { ...signal, _at: Date.now() }, { ex: TTL_SECONDS })
  } catch {
    /* signal bus is a cache — never throw into the caller's path */
  }
  // Durable mirror (JarvisOS dual-write) — a backstop against Redis eviction and
  // an RLS-queryable copy. Best-effort and SILENT: until the domain_signals
  // migration is applied this upsert simply no-ops, and it never throws into the
  // caller. Redis stays the source for hot reads.
  await mirrorSignalDurably(domain, tenantId, signal)
}

async function mirrorSignalDurably<D extends Domain>(
  domain: D,
  tenantId: string,
  signal: SignalMap[D],
): Promise<void> {
  try {
    await supabaseAdmin
      .from('domain_signals')
      .upsert(
        {
          tenant_id: tenantId,
          domain,
          payload: signal,
          health: (signal as { health?: string }).health ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'tenant_id,domain' },
      )
  } catch {
    /* durable mirror is a backstop — never throw, never spam if table absent */
  }
}

/** Durable-store fallback read (RLS-safe) for when Redis is cold/evicted. */
export async function readDurableSignal<D extends Domain>(
  domain: D,
  tenantId: string,
): Promise<SignalMap[D] | null> {
  try {
    const { data } = await supabaseAdmin
      .from('domain_signals')
      .select('payload')
      .eq('tenant_id', tenantId)
      .eq('domain', domain)
      .maybeSingle()
    return (data?.payload as SignalMap[D]) ?? null
  } catch {
    return null
  }
}

/** Read one domain's signal (null if never published / expired). */
export async function readSignal<D extends Domain>(
  domain: D,
  tenantId: string,
): Promise<(SignalMap[D] & { _at: number }) | null> {
  try {
    return (await redis.get(key(domain, tenantId))) as (SignalMap[D] & { _at: number }) | null
  } catch {
    return null
  }
}

/** Read every domain signal at once — the Command Center's fast path. */
export async function readAllSignals(tenantId: string): Promise<Partial<SignalMap>> {
  const domains: Domain[] = ['money', 'sales', 'ops', 'people', 'governance']
  const out: Partial<SignalMap> = {}
  await Promise.all(
    domains.map(async (d) => {
      const s = await readSignal(d, tenantId)
      if (s) {
        (out as Record<string, unknown>)[d] = s
        return
      }
      // Redis miss (cold/evicted) — fall back to the durable mirror so the
      // Command Center still shows the last computed snapshot rather than blanks.
      const durable = await readDurableSignal(d, tenantId)
      if (durable) (out as Record<string, unknown>)[d] = durable
    }),
  )
  return out
}

/** Derive a domain's `mode` from its money signal — used by cross-domain cascades. */
export function financeMode(m: Pick<MoneySignal, 'netPosition' | 'runwayMonths' | 'arStuck'>): MoneySignal['mode'] {
  if (m.netPosition < 0 || (m.runwayMonths !== null && m.runwayMonths < 2)) return 'PROTECT'
  if (m.arStuck > 0 || (m.runwayMonths !== null && m.runwayMonths < 4)) return 'STEADY'
  return 'BUILD'
}
