import { supabaseAdmin } from '@/lib/supabase/admin'
import { callClaudeWithCache, classifyIntent, classifySentiment } from '@/lib/ai/callClaude'
import { checkFAQCache, setFAQCache, incrementTenantCounter } from '@/lib/cache/faqCache'
import { sendWhatsApp } from '@/lib/whatsapp/send'
import { writeAuditLog } from '@/lib/security/audit'
import { Tenant, Message, WellnessScore } from '@/types/database'

interface WorkflowContext {
  tenant: Tenant
  from?: string
  text?: string
  mediaUrl?: string | null
  conversationHistory?: Message[]
  [key: string]: unknown
}

interface WorkflowResult {
  response?: string
  intent?: string
  escalated?: boolean
  error?: string
}

type WorkflowStep = (ctx: WorkflowContext, result: WorkflowResult) => Promise<void>

// Plan conversation limits (monthly)
const PLAN_LIMITS: Record<string, number> = {
  starter:     500,
  business:    5_000,
  enterprise:  Infinity,
  white_label: Infinity,
}

// Wrap any step in a timeout so a single slow step can't stall the whole flow
function withTimeout<T>(promise: Promise<T>, ms: number, stepName: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Step timeout: ${stepName} exceeded ${ms}ms`)), ms)
    ),
  ])
}

// Detect message language from common South African language markers
function detectLanguage(text: string): string {
  const lower = text.toLowerCase()
  const zuluMarkers    = ['sawubona', 'ngiyabonga', 'yebo', 'siyabonga', 'ngicela', 'ngiyaxolisa', 'hamba kahle', 'unjani']
  const xhosaMarkers   = ['molo', 'enkosi', 'ndiyavuya', 'uxolo', 'ndiyaxolisa', 'ewe hayi']
  const afrikaansWords = ['dankie', 'asseblief', 'totsiens', 'baie dankie', 'goeiedag', 'hoe gaan', 'goeiemôre', 'jammer', 'môre']

  if (zuluMarkers.some((w)    => lower.includes(w))) return 'Zulu'
  if (xhosaMarkers.some((w)   => lower.includes(w))) return 'Xhosa'
  if (afrikaansWords.some((w) => lower.includes(w))) return 'Afrikaans'
  return 'English'
}

// Extract a wellness score (1-5) from a WhatsApp reply
function extractWellnessScore(text: string): number | null {
  const trimmed = text.trim()
  // Most common case: bare digit "3" or "3/5" or "3 out of 5"
  const direct = trimmed.match(/^([1-5])(?:\/5| out of 5)?[.!]?$/)
  if (direct) return parseInt(direct[1])
  // Context pattern: "feeling 4", "score: 2", "i'd say 3", "I'm a 4"
  const ctx = trimmed.match(/(?:feeling|score|rate|i(?:'m| am| would say) (?:a |about )?)\s*:?\s*([1-5])/i)
  if (ctx) return parseInt(ctx[1])
  return null
}

const steps = {
  async loadTenantContext(ctx: WorkflowContext): Promise<void> {
    if (!ctx.tenant.system_prompt_cache || !ctx.tenant.prompt_cached_at) return
    const cachedAt  = new Date(ctx.tenant.prompt_cached_at)
    const ageHours  = (Date.now() - cachedAt.getTime()) / 1000 / 3600
    if (ageHours > 24) {
      const { buildCachedSystemPrompt } = await import('@/lib/ai/buildSystemPrompt')
      const prompt = await buildCachedSystemPrompt(ctx.tenant)
      await supabaseAdmin
        .from('tenants')
        .update({ system_prompt_cache: prompt, prompt_cached_at: new Date().toISOString() })
        .eq('id', ctx.tenant.id)
      ctx.tenant.system_prompt_cache = prompt
    }
  },

  async classifyIntent(ctx: WorkflowContext, result: WorkflowResult): Promise<void> {
    if (!ctx.text) return
    // Detect language + intent + sentiment in parallel — no extra latency cost
    const [intent, sentiment, language] = await Promise.all([
      classifyIntent(ctx.text, ctx.tenant.system_prompt_cache || ''),
      classifySentiment(ctx.text),
      Promise.resolve(detectLanguage(ctx.text)),
    ])
    result.intent = intent
    ;(ctx as Record<string, unknown>).sentiment = sentiment
    ;(ctx as Record<string, unknown>).language  = language
  },

  async checkFAQCache(ctx: WorkflowContext, result: WorkflowResult): Promise<void> {
    if (!ctx.text) return
    const cached = await checkFAQCache(ctx.tenant.id, ctx.text)
    if (cached) {
      result.response = cached
      ;(ctx as Record<string, unknown>).fromCache = true
    }
  },

  // Gate the AI call behind plan quota — fail gracefully if over limit
  async checkPlanLimits(ctx: WorkflowContext, result: WorkflowResult): Promise<void> {
    if (result.response) return // FAQ cache already answered — no AI call needed, don't count it
    const plan  = ctx.tenant.plan || 'starter'
    const limit = PLAN_LIMITS[plan] ?? 500
    if (limit === Infinity) return

    const count = await incrementTenantCounter(ctx.tenant.id, 'conversations')
    if (count > limit) {
      result.response = `Thank you for your message! We're currently at capacity for this month. A team member will follow up with you directly as soon as possible.`
      ;(ctx as Record<string, unknown>).overLimit = true
    }
  },

  async generateResponse(ctx: WorkflowContext, result: WorkflowResult): Promise<void> {
    if (result.response) return // already answered (cache or over-limit)
    if (!ctx.text) return

    // Prepend language instruction when the detected language isn't English
    const language      = (ctx as Record<string, unknown>).language as string
    const textToProcess = language && language !== 'English'
      ? `[Please respond in ${language}]\n${ctx.text}`
      : ctx.text

    const aiResult = await callClaudeWithCache(
      ctx.tenant,
      textToProcess,
      ctx.conversationHistory || []
    )

    result.response = aiResult.text
    ;(ctx as Record<string, unknown>).tokens         = aiResult.tokens
    ;(ctx as Record<string, unknown>).fromCache      = aiResult.fromCache
    ;(ctx as Record<string, unknown>).cacheReadTokens = aiResult.cacheReadTokens

    // Cache short FAQ-style responses for future identical questions
    if (ctx.text.length < 150 && aiResult.text.length < 300) {
      await setFAQCache(ctx.tenant.id, ctx.text, aiResult.text)
    }
  },

  async sendWhatsApp(ctx: WorkflowContext, result: WorkflowResult): Promise<void> {
    if (!result.response || !ctx.from) return
    await sendWhatsApp({ to: ctx.from, message: result.response })
  },

  async logToAudit(ctx: WorkflowContext, result: WorkflowResult): Promise<void> {
    await writeAuditLog({
      tenantId: ctx.tenant.id,
      actor:    'ai_agent',
      action:   'whatsapp.inbound.processed',
      metadata: {
        from:           ctx.from,
        intent:         result.intent,
        language:       (ctx as Record<string, unknown>).language,
        fromCache:      (ctx as Record<string, unknown>).fromCache,
        tokens:         (ctx as Record<string, unknown>).tokens,
        cacheReadTokens:(ctx as Record<string, unknown>).cacheReadTokens,
        escalated:      result.escalated,
        overLimit:      (ctx as Record<string, unknown>).overLimit,
      },
    })
  },

  async updateDashboard(ctx: WorkflowContext, result: WorkflowResult): Promise<void> {
    if (!ctx.from || !ctx.text) return

    let conversationId: string
    const { data: existingConv } = await supabaseAdmin
      .from('conversations')
      .select('id')
      .eq('tenant_id', ctx.tenant.id)
      .eq('contact_identifier', ctx.from)
      .eq('status', 'open')
      .maybeSingle()

    const sentiment = (ctx as Record<string, unknown>).sentiment as string | undefined

    if (existingConv) {
      conversationId = existingConv.id
      await supabaseAdmin
        .from('conversations')
        .update({
          updated_at: new Date().toISOString(),
          intent:     result.intent,
          sentiment:  sentiment || undefined,
        })
        .eq('id', conversationId)
    } else {
      const { data: newConv } = await supabaseAdmin
        .from('conversations')
        .insert({
          tenant_id:          ctx.tenant.id,
          channel:            'whatsapp',
          contact_identifier: ctx.from,
          contact_type:       'unknown',
          status:             'open',
          intent:             result.intent,
          sentiment:          sentiment || null,
        })
        .select('id')
        .single()
      conversationId = newConv!.id
    }

    // Store both sides of the exchange in one batch insert
    await supabaseAdmin.from('messages').insert([
      {
        tenant_id:       ctx.tenant.id,
        conversation_id: conversationId,
        role:            'user',
        content:         ctx.text,
        channel:         'whatsapp',
        tokens_used:     null,
        from_cache:      false,
      },
      {
        tenant_id:       ctx.tenant.id,
        conversation_id: conversationId,
        role:            'assistant',
        content:         result.response || '',
        channel:         'whatsapp',
        tokens_used:     (ctx as Record<string, unknown>).tokens as number | null,
        from_cache:      (ctx as Record<string, unknown>).fromCache as boolean || false,
      },
    ])
  },

  // Record wellness check-in scores and send a support message for low scores
  async recordWellness(ctx: WorkflowContext, result: WorkflowResult): Promise<void> {
    if (result.intent !== 'wellness_checkin' || !ctx.from || !ctx.text) return

    const score = extractWellnessScore(ctx.text)
    if (score === null) return

    const { data: staff } = await supabaseAdmin
      .from('staff')
      .select('id, full_name, wellness_scores')
      .eq('tenant_id', ctx.tenant.id)
      .eq('phone', ctx.from)
      .maybeSingle()

    if (!staff) return

    const newEntry: WellnessScore       = { score, date: new Date().toISOString().split('T')[0] }
    const history: WellnessScore[]      = Array.isArray(staff.wellness_scores) ? staff.wellness_scores : []
    const updatedScores: WellnessScore[] = [...history.slice(-11), newEntry]

    await supabaseAdmin
      .from('staff')
      .update({ wellness_scores: updatedScores })
      .eq('id', staff.id)

    // If the score is critically low, send a warm follow-up immediately
    if (score <= 2) {
      const firstName = staff.full_name?.split(' ')[0] || 'there'
      await sendWhatsApp({
        to: ctx.from,
        message: `Hi ${firstName}, thank you for being honest. Your wellbeing matters to us deeply. A manager will check in with you today. You don't have to face this alone. 💚`,
      })
    }
  },
}

async function getTenantByWhatsAppNumber(wabaId: string): Promise<Tenant | null> {
  const { data } = await supabaseAdmin
    .from('tenants')
    .select('*')
    .eq('whatsapp_number', wabaId)
    .eq('active', true)
    .single()
  return data
}

async function getConversationHistory(tenantId: string, from: string): Promise<Message[]> {
  const { data: conv } = await supabaseAdmin
    .from('conversations')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('contact_identifier', from)
    .eq('status', 'open')
    .maybeSingle()

  if (!conv) return []

  const { data } = await supabaseAdmin
    .from('messages')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('conversation_id', conv.id)
    .order('created_at', { ascending: false })
    .limit(10)
  return (data || []).reverse()
}

const STEP_TIMEOUTS: Record<string, number> = {
  loadTenantContext: 5_000,
  classifyIntent:    8_000,
  checkFAQCache:     2_000,
  checkPlanLimits:   3_000,
  generateResponse: 20_000, // Claude call — longest allowed
  sendWhatsApp:      5_000,
  logToAudit:        3_000,
  updateDashboard:   5_000,
  recordWellness:    6_000, // DB write + possible WhatsApp follow-up
}

class AdminWorkflowEngine {
  private flows: Record<string, WorkflowStep[]> = {
    'whatsapp.inbound': [
      steps.loadTenantContext,
      steps.classifyIntent,
      steps.checkFAQCache,
      steps.checkPlanLimits,   // enforce quota before AI call
      steps.generateResponse,
      steps.sendWhatsApp,
      steps.logToAudit,
      steps.updateDashboard,
      steps.recordWellness,    // close the wellness loop last
    ],
  }

  async run(flowName: string, ctx: WorkflowContext): Promise<WorkflowResult> {
    const flow = this.flows[flowName]
    if (!flow) throw new Error(`Unknown flow: ${flowName}`)

    const result: WorkflowResult = {}

    for (const step of flow) {
      const stepName  = step.name
      const timeoutMs = STEP_TIMEOUTS[stepName] || 10_000

      try {
        await withTimeout(step(ctx, result), timeoutMs, stepName)
      } catch (err) {
        console.error(`[WorkflowEngine] Step "${stepName}" failed in ${flowName}:`, err)
        if (!result.response) {
          result.escalated = true
          result.response  = "I'm unable to help right now. A team member will be in touch shortly."
        }
        if (stepName === 'generateResponse' || stepName === 'classifyIntent') {
          await steps.logToAudit(ctx, { ...result, error: String(err) }).catch(() => {})
          break
        }
      }
    }

    return result
  }
}

export const workflowEngine = new AdminWorkflowEngine()
export { getTenantByWhatsAppNumber, getConversationHistory }
