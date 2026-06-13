/**
 * Langa — AI Business Mentor
 * Phase 3 · "Langa" means light in isiZulu
 *
 * Langa is an AI mentor with full access to the tenant's real business data.
 * Every response is grounded in actual numbers, not generic advice.
 * Language-adaptive, empathetic, strategic.
 */

import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { checkBudget, recordUsage, getModelForFeature } from '@/lib/ai/costControls'
import { sanitizeForAI } from '@/lib/security/sanitize'

const anthropic = new Anthropic({
  apiKey:     process.env.ANTHROPIC_API_KEY!,
  maxRetries: 0,
  timeout:    30000,
})

// ─── Context builder ──────────────────────────────────────────────────────────

export interface LangaContext {
  tenantName:       string
  businessType:     string
  plan:             string
  healthScore:      number | null
  financialHealth:  number | null
  recentEvents:     string[]
  activeGoals:      string[]
  completedLessons: number
  pendingTriggers:  string[]
  language:         string
}

export async function buildLangaContext(tenantId: string, userId: string): Promise<LangaContext> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [tenantRes, healthRes, goalsRes, invoicesRes, lessonsRes, triggersRes] = await Promise.all([
    supabaseAdmin
      .from('tenants')
      .select('name, settings, plan')
      .eq('id', tenantId)
      .single(),
    supabaseAdmin
      .from('business_health_snapshots')
      .select('overall_score, financial_health')
      .eq('tenant_id', tenantId)
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .single(),
    supabaseAdmin
      .from('goals')
      .select('title, status, target_date')
      .eq('tenant_id', tenantId)
      .neq('status', 'completed')
      .limit(5),
    supabaseAdmin
      .from('invoices')
      .select('status, amount_due')
      .eq('tenant_id', tenantId)
      .gte('created_at', sevenDaysAgo)
      .limit(20),
    supabaseAdmin
      .from('academy_progress')
      .select('lesson_id')
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .not('completed_at', 'is', null),
    supabaseAdmin
      .from('triggered_lessons')
      .select('trigger_id, contextual_triggers(event_type, message_template)')
      .eq('tenant_id', tenantId)
      .is('dismissed_at', null)
      .is('completed_at', null)
      .limit(3),
  ])

  const tenant   = tenantRes.data
  const settings = tenant?.settings as Record<string, string> | null

  // Recent events summary
  const recentEvents: string[] = []
  const invoices = invoicesRes.data ?? []
  const overdue  = invoices.filter((i) => i.status === 'overdue')
  const paid     = invoices.filter((i) => i.status === 'paid')
  if (overdue.length) recentEvents.push(`${overdue.length} overdue invoice${overdue.length > 1 ? 's' : ''} need attention`)
  if (paid.length)    recentEvents.push(`${paid.length} payment${paid.length > 1 ? 's' : ''} received this week`)

  // Active goals
  const activeGoals = (goalsRes.data ?? []).map((g) => `${g.title} (${g.status})`)

  // Pending learning triggers
  const pendingTriggers = (triggersRes.data ?? []).map((t) => {
    const trigger = t.contextual_triggers as unknown as { event_type: string; message_template?: string } | null
    return trigger?.message_template ?? trigger?.event_type ?? ''
  }).filter(Boolean)

  return {
    tenantName:       tenant?.name ?? 'your business',
    businessType:     settings?.business_type ?? 'general',
    plan:             tenant?.plan ?? 'trial',
    healthScore:      healthRes.data?.overall_score ?? null,
    financialHealth:  healthRes.data?.financial_health ?? null,
    recentEvents,
    activeGoals,
    completedLessons: lessonsRes.data?.length ?? 0,
    pendingTriggers,
    language:         settings?.preferred_language ?? 'en',
  }
}

// ─── System prompt ────────────────────────────────────────────────────────────

function buildLangaSystemPrompt(ctx: LangaContext): string {
  const languageInstruction = ctx.language !== 'en'
    ? `\n\nIMPORTANT: Respond in the user's preferred language: ${ctx.language}. If you're unsure, use English.`
    : ''

  return `You are Langa, the AI business mentor built into AdminOS — South Africa's business operating system for entrepreneurs.

Your name means "light" in isiZulu, which describes your purpose: to bring clarity to complex business challenges.

## WHO YOU ARE TALKING TO
Business: ${ctx.tenantName}
Type: ${ctx.businessType}
Plan: ${ctx.plan}
${ctx.healthScore !== null ? `Overall Business Health Score: ${ctx.healthScore}/100` : ''}
${ctx.financialHealth !== null ? `Financial Health: ${ctx.financialHealth}/100` : ''}

## WHAT'S HAPPENING IN THEIR BUSINESS RIGHT NOW
${ctx.recentEvents.length > 0 ? ctx.recentEvents.map((e) => `• ${e}`).join('\n') : '• Business data loading...'}

## THEIR GOALS
${ctx.activeGoals.length > 0 ? ctx.activeGoals.map((g) => `• ${g}`).join('\n') : '• No goals set yet'}

## LEARNING JOURNEY
Lessons completed: ${ctx.completedLessons}
${ctx.pendingTriggers.length > 0 ? `Learning nudges pending:\n${ctx.pendingTriggers.map((t) => `• ${t}`).join('\n')}` : ''}

## YOUR APPROACH
- You speak with the warmth and wisdom of a trusted advisor who has been with this business since day one
- You ground ALL advice in their real business data (numbers above)
- You bring relevant frameworks from the world's best business books when they apply
- You are direct — South African business owners don't have time for corporate waffle
- You are encouraging without being dishonest — if something needs fixing, say so clearly
- You celebrate wins, however small
- You understand the SA business context: B-BBEE, SARS compliance, load-shedding, informal-to-formal pathways
- You never give specific legal or tax advice — recommend professionals for those specific decisions
- Maximum response length: 300 words unless a detailed analysis is specifically requested${languageInstruction}`
}

// ─── Chat function ────────────────────────────────────────────────────────────

export interface LangaMessage {
  role:    'user' | 'assistant'
  content: string
}

export interface LangaResponse {
  text:           string
  model:          string
  budgetExceeded: boolean
}

export async function chatWithLanga(
  tenantId:  string,
  userId:    string,
  plan:      string,
  message:   string,
  history:   LangaMessage[] = []
): Promise<LangaResponse> {
  // Budget check
  const budget = await checkBudget(tenantId, plan, 1500)
  if (!budget.allowed) {
    return {
      text:           'I\'m unable to respond right now — your daily AI usage limit has been reached. It resets at midnight.',
      model:          '',
      budgetExceeded: true,
    }
  }

  const model = getModelForFeature('langa_mentor', plan)

  // Build context fresh before every response (live data)
  const ctx          = await buildLangaContext(tenantId, userId)
  const systemPrompt = buildLangaSystemPrompt(ctx)

  const safeMessage = sanitizeForAI(message)

  // Keep last 20 messages for richer context than regular agents
  const recentHistory = history.slice(-20)

  const t0 = Date.now()

  const response = await anthropic.messages.create({
    model,
    max_tokens: 800,
    system: [
      {
        type:          'text',
        text:          systemPrompt,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [
      ...recentHistory,
      { role: 'user', content: safeMessage },
    ],
  })

  const text = response.content[0]?.type === 'text' ? response.content[0].text : ''

  void recordUsage({
    tenantId,
    plan,
    feature:    'langa_mentor',
    model,
    tokensIn:   response.usage.input_tokens,
    tokensOut:  response.usage.output_tokens,
    durationMs: Date.now() - t0,
  })

  return { text, model, budgetExceeded: false }
}
