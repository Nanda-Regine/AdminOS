import Anthropic from '@anthropic-ai/sdk'
import { Tenant, Message } from '@/types/database'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

export async function callClaudeWithCache(
  tenant: Tenant,
  userMessage: string,
  conversationHistory: Message[]
) {
  const history = conversationHistory.map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }))

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1000,
    system: [
      {
        type: 'text',
        text: tenant.system_prompt_cache || '',
        // @ts-expect-error cache_control is valid in Anthropic SDK
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [
      ...history,
      { role: 'user', content: userMessage },
    ],
  })

  const content = response.content[0]
  const text = content.type === 'text' ? content.text : ''
  const inputTokens = response.usage.input_tokens
  const cacheReadTokens = (response.usage as Record<string, number>).cache_read_input_tokens || 0
  const fromCache = cacheReadTokens > 0

  return {
    text,
    tokens: inputTokens + response.usage.output_tokens,
    fromCache,
  }
}

export async function callClaudeAgent(
  systemPrompt: string,
  userMessage: string,
  maxTokens = 500
) {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  })

  const content = response.content[0]
  return content.type === 'text' ? content.text : ''
}

export async function classifyIntent(text: string, tenantContext: string): Promise<string> {
  const result = await callClaudeAgent(
    `${tenantContext}\n\nClassify the intent of the following message into ONE of: leave_request, invoice_query, general_faq, complaint, appointment, wellness_checkin, document_request, other. Reply with ONLY the intent label.`,
    text,
    50
  )
  return result.trim().toLowerCase()
}

export async function classifyDocument(extractedText: string): Promise<{
  category: 'strategy' | 'invoice' | 'hr' | 'report' | 'contract'
  confidence: number
}> {
  const result = await callClaudeAgent(
    `Classify this document into ONE of: strategy, invoice, hr, report, contract. Reply with JSON: {"category":"...", "confidence": 0.0-1.0}`,
    extractedText.slice(0, 3000),
    100
  )
  try {
    return JSON.parse(result)
  } catch {
    return { category: 'report', confidence: 0.5 }
  }
}

export async function extractGoalsFromDoc(text: string): Promise<Array<{
  title: string
  description: string
  quarter?: string
  target_metric?: string
  target_value?: number
}>> {
  const result = await callClaudeAgent(
    `Extract all business goals, KPIs, and milestones from this document. Reply with a JSON array: [{"title":"...","description":"...","quarter":"...","target_metric":"...","target_value":0}]`,
    text.slice(0, 5000),
    1000
  )
  try {
    const jsonMatch = result.match(/\[[\s\S]*\]/)
    return jsonMatch ? JSON.parse(jsonMatch[0]) : []
  } catch {
    return []
  }
}

export async function draftRecoveryMessage(params: {
  tenantName: string
  contact: string
  amount: number
  daysOverdue: number
  tone: string
  includePaymentLink: boolean
}): Promise<string> {
  return callClaudeAgent(
    `You are a professional debt recovery assistant for ${params.tenantName}. Draft a ${params.tone} payment reminder. Keep it under 250 characters for WhatsApp. Be firm but respectful.`,
    `Contact: ${params.contact}\nAmount owed: R${params.amount}\nDays overdue: ${params.daysOverdue}\nInclude payment link: ${params.includePaymentLink}`,
    300
  )
}

export async function generateDailyBrief(tenantData: {
  tenantName: string
  openConversations: number
  overdueInvoices: number
  totalDebt: number
  staffOnLeave: number
  wellnessAvg: number
  topGoals: string[]
}): Promise<string> {
  return callClaudeAgent(
    `You are a world-class business advisor. Generate a concise daily brief for ${tenantData.tenantName}. Be direct, data-driven, and actionable. Max 300 words.`,
    JSON.stringify(tenantData),
    500
  )
}
