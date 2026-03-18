import { supabaseAdmin } from '@/lib/supabase/admin'
import { callClaudeWithCache, classifyIntent } from '@/lib/ai/callClaude'
import { checkFAQCache, setFAQCache } from '@/lib/cache/faqCache'
import { sendWhatsApp } from '@/lib/whatsapp/send'
import { writeAuditLog } from '@/lib/security/audit'
import { Tenant, Message } from '@/types/database'

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

// Wrap any step in a timeout so a single slow step can't stall the whole flow
function withTimeout<T>(promise: Promise<T>, ms: number, stepName: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Step timeout: ${stepName} exceeded ${ms}ms`)), ms)
    ),
  ])
}

const steps = {
  async loadTenantContext(ctx: WorkflowContext): Promise<void> {
    if (!ctx.tenant.system_prompt_cache || !ctx.tenant.prompt_cached_at) return
    const cachedAt = new Date(ctx.tenant.prompt_cached_at)
    const ageHours = (Date.now() - cachedAt.getTime()) / 1000 / 3600
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
    result.intent = await classifyIntent(ctx.text, ctx.tenant.system_prompt_cache || '')
  },

  async checkFAQCache(ctx: WorkflowContext, result: WorkflowResult): Promise<void> {
    if (!ctx.text) return
    const cached = await checkFAQCache(ctx.tenant.id, ctx.text)
    if (cached) {
      result.response = cached
      ;(ctx as Record<string, unknown>).fromCache = true
    }
  },

  async generateResponse(ctx: WorkflowContext, result: WorkflowResult): Promise<void> {
    if (result.response) return // already answered from cache
    if (!ctx.text) return

    const aiResult = await callClaudeWithCache(
      ctx.tenant,
      ctx.text,
      ctx.conversationHistory || []
    )

    result.response = aiResult.text
    ;(ctx as Record<string, unknown>).tokens = aiResult.tokens
    ;(ctx as Record<string, unknown>).fromCache = aiResult.fromCache
    ;(ctx as Record<string, unknown>).cacheReadTokens = aiResult.cacheReadTokens

    // Cache FAQ-like responses: short question, concise answer
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
      actor: 'ai_agent',
      action: 'whatsapp.inbound.processed',
      metadata: {
        from: ctx.from,
        intent: result.intent,
        fromCache: (ctx as Record<string, unknown>).fromCache,
        tokens: (ctx as Record<string, unknown>).tokens,
        cacheReadTokens: (ctx as Record<string, unknown>).cacheReadTokens,
        escalated: result.escalated,
      },
    })
  },

  async updateDashboard(ctx: WorkflowContext, result: WorkflowResult): Promise<void> {
    if (!ctx.from || !ctx.text) return

    // Find or create open conversation for this contact
    let conversationId: string
    const { data: existingConv } = await supabaseAdmin
      .from('conversations')
      .select('id')
      .eq('tenant_id', ctx.tenant.id)
      .eq('contact_identifier', ctx.from)
      .eq('status', 'open')
      .maybeSingle()

    if (existingConv) {
      conversationId = existingConv.id
      await supabaseAdmin
        .from('conversations')
        .update({ updated_at: new Date().toISOString(), intent: result.intent })
        .eq('id', conversationId)
    } else {
      const { data: newConv } = await supabaseAdmin
        .from('conversations')
        .insert({
          tenant_id: ctx.tenant.id,
          channel: 'whatsapp',
          contact_identifier: ctx.from,
          contact_type: 'unknown',
          status: 'open',
          intent: result.intent,
        })
        .select('id')
        .single()
      conversationId = newConv!.id
    }

    // Store both sides of the exchange in one batch insert
    await supabaseAdmin.from('messages').insert([
      {
        tenant_id: ctx.tenant.id,
        conversation_id: conversationId,
        role: 'user',
        content: ctx.text,
        channel: 'whatsapp',
        tokens_used: null,
        from_cache: false,
      },
      {
        tenant_id: ctx.tenant.id,
        conversation_id: conversationId,
        role: 'assistant',
        content: result.response || '',
        channel: 'whatsapp',
        tokens_used: (ctx as Record<string, unknown>).tokens as number | null,
        from_cache: (ctx as Record<string, unknown>).fromCache as boolean || false,
      },
    ])
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
  const { data } = await supabaseAdmin
    .from('messages')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(10)
  return (data || []).reverse()
}

const STEP_TIMEOUTS: Record<string, number> = {
  loadTenantContext: 5000,
  classifyIntent:    8000,
  checkFAQCache:     2000,
  generateResponse: 20000, // Claude call — longest allowed
  sendWhatsApp:      5000,
  logToAudit:        3000,
  updateDashboard:   5000,
}

class AdminWorkflowEngine {
  private flows: Record<string, WorkflowStep[]> = {
    'whatsapp.inbound': [
      steps.loadTenantContext,
      steps.classifyIntent,
      steps.checkFAQCache,
      steps.generateResponse,
      steps.sendWhatsApp,
      steps.logToAudit,
      steps.updateDashboard,
    ],
  }

  async run(flowName: string, ctx: WorkflowContext): Promise<WorkflowResult> {
    const flow = this.flows[flowName]
    if (!flow) throw new Error(`Unknown flow: ${flowName}`)

    const result: WorkflowResult = {}

    for (const step of flow) {
      const stepName = step.name
      const timeoutMs = STEP_TIMEOUTS[stepName] || 10000

      try {
        await withTimeout(step(ctx, result), timeoutMs, stepName)
      } catch (err) {
        console.error(`[WorkflowEngine] Step "${stepName}" failed in ${flowName}:`, err)
        // If AI generation failed and we have no response yet, escalate to human
        if (!result.response) {
          result.escalated = true
          result.response =
            "I'm unable to help right now. A team member will be in touch shortly."
        }
        // Log the failure but don't stop the remaining safe steps (audit + dashboard)
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
