import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { writeAuditLog } from '@/lib/security/audit'
import type { AgentName, AgentConfig, OrchestratorRequest, OrchestratorResponse } from './types'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

const AGENT_CONFIGS: Record<AgentName, AgentConfig> = {
  alex: {
    name: 'alex',
    displayName: 'Alex — Inbox Agent',
    description: 'Handles customer conversations, drafts replies, and triages inbound messages',
    model: 'claude-sonnet-4-6',
    maxTokens: 600,
    systemPrompt: `You are Alex, the Inbox Agent for AdminOS — an AI business OS for South African SMEs.
Your job: handle customer WhatsApp conversations with warmth, clarity, and cultural intelligence.
Rules:
- Reply in the language the customer uses (English, Zulu, Xhosa, Afrikaans, Sotho supported)
- Keep WhatsApp replies under 250 characters unless the situation demands more
- Always be warm and professional, never robotic
- Flag urgent matters clearly
- Use South African context (load shedding, public holidays, Rand amounts)`,
    streaming: false,
  },
  chase: {
    name: 'chase',
    displayName: 'Chase — Debt Recovery Agent',
    description: 'Recovers outstanding invoices using a 5-tier escalation approach',
    model: 'claude-haiku-4-5-20251001',
    maxTokens: 300,
    systemPrompt: `You are Chase, the Debt Recovery Agent for AdminOS.
Your job: recover outstanding payments with firmness calibrated to the tier.
Tier 1 (1-2 days): Friendly reminder. Tier 2 (3-6 days): Polite follow-up.
Tier 3 (7-13 days): Firm professional notice. Tier 4 (14-29 days): Serious final notice.
Tier 5 (30+ days): Formal letter of demand.
Rules:
- Always include the invoice reference and exact Rand amount
- Keep WhatsApp messages under 250 characters
- Never threaten illegal action or use aggressive language
- Preserve the business relationship wherever possible`,
    streaming: false,
  },
  care: {
    name: 'care',
    displayName: 'Care — Wellness Agent',
    description: 'Monitors staff wellbeing and surfaces burnout risk early',
    model: 'claude-sonnet-4-6',
    maxTokens: 400,
    systemPrompt: `You are Care, the Wellness Agent for AdminOS.
Your job: support staff wellbeing with empathy, not surveillance.
Rules:
- Respond to wellness check-ins with warmth and genuine interest
- When scores are low (below 3/5), acknowledge and ask one open question
- Never share individual data with the employer — only anonymised trends
- Support, don't diagnose
- Be especially aware of South African workplace challenges (commuting, loadshedding, unemployment anxiety)`,
    streaming: false,
  },
  doc: {
    name: 'doc',
    displayName: 'Doc — Document Intelligence Agent',
    description: 'Classifies, extracts, and summarises documents automatically',
    model: 'claude-haiku-4-5-20251001',
    maxTokens: 1000,
    systemPrompt: `You are Doc, the Document Intelligence Agent for AdminOS.
Your job: extract structure and meaning from business documents.
Rules:
- Always return structured JSON when asked
- Never hallucinate amounts, dates, or parties — only extract what is present
- For contracts: extract parties, obligations, expiry dates, and key terms
- For invoices: extract amounts (in Rand), due dates, reference numbers
- Confidence scores must be honest — use 0.5 for unclear documents`,
    streaming: false,
  },
  insight: {
    name: 'insight',
    displayName: 'Insight — Analytics Agent',
    description: 'Generates daily briefs and strategic business intelligence',
    model: 'claude-haiku-4-5-20251001',
    maxTokens: 600,
    systemPrompt: `You are Insight, the Analytics Agent for AdminOS.
Your job: turn business data into concise, actionable intelligence for South African SME owners.
Rules:
- Be direct and data-driven — SME owners have no time for fluff
- Always end daily briefs with "Top 3 actions for today:" and 3 specific actions
- Reference actual numbers from the data provided
- Highlight risks early — cash flow, staff, compliance
- Frame insights for a South African business context`,
    streaming: false,
  },
  pen: {
    name: 'pen',
    displayName: 'Pen — Email Studio Agent',
    description: 'Drafts professional emails with tone control and multi-language support',
    model: 'claude-sonnet-4-6',
    maxTokens: 800,
    streaming: true,
    systemPrompt: `You are Pen, the Email Studio Agent for AdminOS.
Your job: write professional, effective emails for South African business owners.
Rules:
- Match the requested tone exactly: formal, friendly, firm, or urgent
- Use correct South African business English conventions
- Include clear subject lines when requested
- For debt/legal emails: precise language, no warmth at tier 4+
- Keep emails scannable: short paragraphs, clear asks
- Support bilingual emails when requested (English + Afrikaans, English + Zulu, etc.)
- Never include placeholder text — always complete the draft`,
  },
}

export class AgentOrchestrator {
  private async buildContext(req: OrchestratorRequest): Promise<string> {
    const parts: string[] = []

    if (req.contactIdentifier) {
      const [contact, invoices, recentConvs] = await Promise.all([
        supabaseAdmin
          .from('contacts')
          .select('full_name, company, sentiment_score, total_invoiced, total_paid, last_contacted_at')
          .eq('tenant_id', req.tenantId)
          .eq('phone', req.contactIdentifier)
          .maybeSingle(),
        supabaseAdmin
          .from('invoices')
          .select('reference, amount, days_overdue, status, recovery_tier')
          .eq('tenant_id', req.tenantId)
          .eq('contact_phone', req.contactIdentifier)
          .order('created_at', { ascending: false })
          .limit(3),
        supabaseAdmin
          .from('conversations')
          .select('intent, sentiment, status, created_at')
          .eq('tenant_id', req.tenantId)
          .eq('contact_identifier', req.contactIdentifier)
          .order('created_at', { ascending: false })
          .limit(5),
      ])

      if (contact.data) parts.push(`CONTACT: ${JSON.stringify(contact.data)}`)
      if (invoices.data?.length) parts.push(`INVOICES: ${JSON.stringify(invoices.data)}`)
      if (recentConvs.data?.length) parts.push(`RECENT_CONVS: ${JSON.stringify(recentConvs.data)}`)
    }

    if (req.documentId) {
      const { data: doc } = await supabaseAdmin
        .from('documents')
        .select('file_name, document_type, ai_summary, extracted_data')
        .eq('id', req.documentId)
        .single()
      if (doc) parts.push(`DOCUMENT: ${JSON.stringify(doc)}`)
    }

    if (req.agentName === 'insight') {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const [convRes, invoiceRes, goalRes] = await Promise.all([
        supabaseAdmin.from('conversations').select('id', { count: 'exact' }).eq('tenant_id', req.tenantId).eq('status', 'open'),
        supabaseAdmin.from('invoices').select('amount, days_overdue').eq('tenant_id', req.tenantId).in('status', ['unpaid', 'partial']),
        supabaseAdmin.from('goals').select('title, progress_pct, status').eq('tenant_id', req.tenantId).eq('status', 'active').limit(5),
      ])
      parts.push(`OPEN_CONVS: ${convRes.count ?? 0}`)
      parts.push(`OVERDUE_INVOICES: ${JSON.stringify(invoiceRes.data ?? [])}`)
      parts.push(`GOALS: ${JSON.stringify(goalRes.data ?? [])}`)
    }

    if (parts.length > 0) {
      return `[BUSINESS CONTEXT]\n${parts.join('\n\n')}\n\n[USER MESSAGE]\n${req.userMessage}`
    }
    return req.userMessage
  }

  async run(req: OrchestratorRequest): Promise<OrchestratorResponse> {
    const config = AGENT_CONFIGS[req.agentName]
    const startMs = Date.now()

    const contextBlock = await this.buildContext(req)

    const response = await anthropic.messages.create({
      model: config.model,
      max_tokens: config.maxTokens,
      system: [
        {
          type: 'text',
          text: config.systemPrompt,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: contextBlock }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const latencyMs = Date.now() - startMs
    const cached = (response.usage.cache_read_input_tokens ?? 0) > 0

    await writeAuditLog({
      tenantId: req.tenantId,
      actor: req.agentName,
      action: `agent.${req.agentName}.called`,
      resourceType: req.conversationId ? 'conversation' : req.documentId ? 'document' : undefined,
      resourceId: req.conversationId ?? req.documentId,
      metadata: {
        model: config.model,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        cached,
        latencyMs,
      },
    })

    return {
      agentName: req.agentName,
      response: text,
      model: config.model,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      cached,
      latencyMs,
    }
  }

  async stream(req: OrchestratorRequest): Promise<ReadableStream> {
    const config = AGENT_CONFIGS[req.agentName]
    const contextBlock = await this.buildContext(req)

    const stream = await anthropic.messages.stream({
      model: config.model,
      max_tokens: config.maxTokens,
      system: [
        {
          type: 'text',
          text: config.systemPrompt,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: contextBlock }],
    })

    return new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          if (
            chunk.type === 'content_block_delta' &&
            chunk.delta.type === 'text_delta'
          ) {
            controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`))
          }
        }
        controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'))
        controller.close()
      },
    })
  }
}

export const orchestrator = new AgentOrchestrator()
export { AGENT_CONFIGS }
