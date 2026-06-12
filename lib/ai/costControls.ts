/**
 * AI Cost Controls — Phase 0.3
 *
 * Central enforcement layer for all Claude API calls.
 * Every AI call must pass through checkBudget() before the API call
 * and recordUsage() after. See MASTER_PROTOCOLS.md §10.
 */

import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

// ─── Model constants ──────────────────────────────────────────────────────────

export const MODELS = {
  HAIKU:  'claude-haiku-4-5-20251001',
  SONNET: 'claude-sonnet-4-6',
  OPUS:   'claude-opus-4-8',
} as const

export type AIModel = typeof MODELS[keyof typeof MODELS]

// ─── Daily token budgets by plan ──────────────────────────────────────────────

const DAILY_TOKEN_BUDGET: Record<string, number> = {
  trial:       25_000,
  solo:        50_000,
  starter:     50_000,   // legacy name → same as solo
  grow:       200_000,
  growth:     200_000,   // legacy name → same as grow
  operate:    500_000,
  business:   500_000,   // legacy name → same as operate
  scale:    1_000_000,
  enterprise: 1_000_000, // legacy name → same as scale
  partner:  2_000_000,
  white_label: 2_000_000, // legacy name → same as partner
}

export function getDailyTokenLimit(plan: string): number {
  return DAILY_TOKEN_BUDGET[plan] ?? DAILY_TOKEN_BUDGET.trial
}

// ─── Model routing by feature ─────────────────────────────────────────────────

type FeatureRouter = (plan: string) => AIModel

const FEATURE_MODEL_MAP: Record<string, FeatureRouter> = {
  // Always Haiku — high volume, routine
  daily_brief_solo:      (_) => MODELS.HAIKU,
  chase_message:         (_) => MODELS.HAIKU,
  wellness_check:        (_) => MODELS.HAIKU,
  intent_classify:       (_) => MODELS.HAIKU,
  sentiment_classify:    (_) => MODELS.HAIKU,
  announcement_draft:    (_) => MODELS.HAIKU,
  faq_answer:            (_) => MODELS.HAIKU,
  widget_reply:          (_) => MODELS.HAIKU,

  // Sonnet — standard quality features
  daily_brief:           (_) => MODELS.SONNET,
  langa_mentor:          (_) => MODELS.SONNET,
  advisor_agent:         (_) => MODELS.SONNET,
  document_analysis:     (_) => MODELS.SONNET,
  contract_analysis:     (_) => MODELS.SONNET,
  email_studio:          (_) => MODELS.SONNET,
  onboarding_sequence:   (_) => MODELS.SONNET,
  book_in_action:        (_) => MODELS.SONNET,
  health_score_insight:  (_) => MODELS.SONNET,
  cashflow_forecast:     (_) => MODELS.SONNET,

  // Opus — premium only (scale/partner plans)
  board_pack:            (p) => isPremiumEnterprisePlan(p) ? MODELS.OPUS : MODELS.SONNET,
  exit_analysis:         (p) => isPremiumEnterprisePlan(p) ? MODELS.OPUS : MODELS.SONNET,
  strategic_advisor:     (p) => isPremiumEnterprisePlan(p) ? MODELS.OPUS : MODELS.SONNET,
  valuation_analysis:    (p) => isPremiumEnterprisePlan(p) ? MODELS.OPUS : MODELS.SONNET,
}

function isPremiumEnterprisePlan(plan: string): boolean {
  return ['scale', 'enterprise', 'partner', 'white_label'].includes(plan)
}

/**
 * Get the correct Claude model for a feature given the tenant's plan.
 * Defaults to Haiku for unknown features to protect costs.
 */
export function getModelForFeature(feature: string, plan: string): AIModel {
  const router = FEATURE_MODEL_MAP[feature]
  return router ? router(plan) : MODELS.HAIKU
}

// ─── Redis key helpers ────────────────────────────────────────────────────────

function todayUTC(): string {
  const d = new Date()
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

function thisHourUTC(): string {
  return `${todayUTC()}T${String(new Date().getUTCHours()).padStart(2, '0')}`
}

export function budgetKey(tenantId: string): string {
  return `ai:budget:${tenantId}:${todayUTC()}`
}

export function hourlyAbuseKey(tenantId: string): string {
  return `ai:abuse:${tenantId}:${thisHourUTC()}`
}

export function rateLimitKey(tenantId: string, feature: string): string {
  return `ai:rate:${tenantId}:${feature}:${thisHourUTC()}`
}

export function abuseFlagKey(tenantId: string): string {
  return `ai:abuse:flag:${tenantId}`
}

// ─── Budget check ─────────────────────────────────────────────────────────────

export interface BudgetCheckResult {
  allowed: boolean
  remaining: number
  used: number
  limit: number
  reason?: 'abuse_flagged' | 'daily_budget_exceeded'
}

/**
 * Check if a tenant has budget remaining before making an AI call.
 * Call this BEFORE the Claude API call. If `allowed` is false, do not proceed.
 */
export async function checkBudget(
  tenantId: string,
  plan: string,
  estimatedTokens = 1000
): Promise<BudgetCheckResult> {
  const limit = getDailyTokenLimit(plan)
  const key   = budgetKey(tenantId)

  // Abuse flag overrides everything
  const abused = await redis.get<string>(abuseFlagKey(tenantId))
  if (abused) {
    return { allowed: false, remaining: 0, used: limit, limit, reason: 'abuse_flagged' }
  }

  const used      = (await redis.get<number>(key)) ?? 0
  const remaining = Math.max(0, limit - used)

  if (remaining < estimatedTokens) {
    return { allowed: false, remaining, used, limit, reason: 'daily_budget_exceeded' }
  }

  return { allowed: true, remaining, used, limit }
}

// ─── Usage recording ──────────────────────────────────────────────────────────

export interface RecordUsageParams {
  tenantId:   string
  plan:       string
  feature:    string
  model:      string
  tokensIn:   number
  tokensOut:  number
  durationMs?: number
}

/**
 * Record actual token usage after a Claude API call.
 * Increments the Redis daily budget counter and the hourly spike tracker.
 * DB write is fire-and-forget — does not block the response.
 */
export async function recordUsage(params: RecordUsageParams): Promise<void> {
  const { tenantId, plan, feature, model, tokensIn, tokensOut, durationMs } = params
  const totalTokens = tokensIn + tokensOut

  // Increment daily budget (48h TTL covers midnight boundary)
  await redis.incrby(budgetKey(tenantId), totalTokens)
  await redis.expire(budgetKey(tenantId), 60 * 60 * 48)

  // Hourly spike tracking
  const hourlyCount = await redis.incrby(hourlyAbuseKey(tenantId), totalTokens)
  await redis.expire(hourlyAbuseKey(tenantId), 60 * 60 * 2)

  // Abuse detection: >50% of daily budget in a single hour
  const limit = getDailyTokenLimit(plan)
  if (hourlyCount > limit * 0.5) {
    await redis.set(abuseFlagKey(tenantId), '1', { ex: 60 * 60 * 24 })
    console.warn(
      `[ABUSE ALERT] Tenant ${tenantId} consumed ${hourlyCount} tokens in 1 hour ` +
      `(${Math.round((hourlyCount / limit) * 100)}% of daily ${plan} budget)`
    )
  }

  const costUsd = estimateCost(model, tokensIn, tokensOut)

  // Fire-and-forget DB log — never blocks the API response
  void import('@/lib/supabase/admin').then(({ supabaseAdmin }) =>
    supabaseAdmin.from('ai_usage_logs').insert({
      tenant_id:   tenantId,
      feature,
      model,
      tokens_in:   tokensIn,
      tokens_out:  tokensOut,
      cost_usd:    costUsd,
      duration_ms: durationMs ?? null,
    })
  ).catch((e: unknown) => console.error('[ai:usage-log-failed]', e))
}

// ─── Cost estimation ──────────────────────────────────────────────────────────

// Rates in USD per token (approximate — update when Anthropic changes pricing)
const COST_RATES: Record<string, { in: number; out: number }> = {
  [MODELS.HAIKU]:  { in: 0.00000025, out: 0.00000125 }, // $0.25/$1.25 per M
  [MODELS.SONNET]: { in: 0.000003,   out: 0.000015   }, // $3/$15 per M
  [MODELS.OPUS]:   { in: 0.000015,   out: 0.000075   }, // $15/$75 per M
}

export function estimateCost(model: string, tokensIn: number, tokensOut: number): number {
  const rate = COST_RATES[model] ?? COST_RATES[MODELS.SONNET]
  return tokensIn * rate.in + tokensOut * rate.out
}

/** Convert USD cost to ZAR (rough — update with live rate or env var) */
export function usdToZar(usd: number): number {
  const rate = parseFloat(process.env.USD_ZAR_RATE ?? '18.5')
  return usd * rate
}
