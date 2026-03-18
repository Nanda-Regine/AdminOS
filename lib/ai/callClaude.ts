import Anthropic from '@anthropic-ai/sdk'
import { Tenant, Message } from '@/types/database'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
  maxRetries: 0, // We handle retries ourselves for better control
  timeout: 25000, // 25s — leaves headroom within Vercel's 30s limit
})

// Exponential backoff retry for transient Anthropic errors
async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  baseDelayMs = 800
): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (err: unknown) {
      const isLast = attempt === retries
      const isRetryable =
        err instanceof Error &&
        (err.message.includes('529') || // Anthropic overloaded
          err.message.includes('502') ||
          err.message.includes('503') ||
          err.message.includes('rate_limit') ||
          err.message.includes('timeout') ||
          err.message.toLowerCase().includes('overloaded'))

      if (isLast || !isRetryable) throw err

      const jitter = Math.random() * 200
      await new Promise((r) =>
        setTimeout(r, baseDelayMs * Math.pow(2, attempt) + jitter)
      )
    }
  }
  // Unreachable but TypeScript needs it
  throw new Error('Retry limit exceeded')
}

export async function callClaudeWithCache(
  tenant: Tenant,
  userMessage: string,
  conversationHistory: Message[]
) {
  // Keep last 10 messages to cap context size and cost
  const history = conversationHistory.slice(-10).map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }))

  const response = await withRetry(() =>
    anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      system: [
        {
          type: 'text',
          text: tenant.system_prompt_cache || '',
          cache_control: { type: 'ephemeral' }, // Prompt caching — 85% cost saving
        },
      ],
      messages: [
        ...history,
        { role: 'user', content: userMessage },
      ],
    })
  )

  const content = response.content[0]
  const text = content.type === 'text' ? content.text : ''
  const usageExtra = response.usage as unknown as Record<string, number>
  const cacheReadTokens = usageExtra.cache_read_input_tokens || 0
  const cacheWriteTokens = usageExtra.cache_creation_input_tokens || 0
  const fromCache = cacheReadTokens > 0

  return {
    text,
    tokens: response.usage.input_tokens + response.usage.output_tokens,
    cacheReadTokens,
    cacheWriteTokens,
    fromCache,
  }
}

export async function callClaudeAgent(
  systemPrompt: string,
  userMessage: string,
  maxTokens = 500
) {
  const response = await withRetry(() =>
    anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    })
  )

  const content = response.content[0]
  return content.type === 'text' ? content.text : ''
}

export async function classifyIntent(
  text: string,
  tenantContext: string
): Promise<string> {
  const result = await callClaudeAgent(
    `${tenantContext}\n\nClassify the intent of the following message into ONE of: leave_request, invoice_query, general_faq, complaint, appointment, wellness_checkin, document_request, other. Reply with ONLY the intent label.`,
    text,
    50
  )
  return result.trim().toLowerCase()
}

export async function classifySentiment(text: string): Promise<string> {
  const result = await callClaudeAgent(
    'Classify the sentiment of this message into ONE of: positive, neutral, negative, urgent. Reply with ONLY the label.',
    text,
    20
  )
  const sentiment = result.trim().toLowerCase()
  const valid = ['positive', 'neutral', 'negative', 'urgent']
  return valid.includes(sentiment) ? sentiment : 'neutral'
}

export async function classifyDocument(extractedText: string): Promise<{
  category: 'strategy' | 'invoice' | 'hr' | 'report' | 'contract'
  confidence: number
}> {
  const result = await callClaudeAgent(
    'Classify this document into ONE of: strategy, invoice, hr, report, contract. Reply with JSON only: {"category":"...", "confidence": 0.0-1.0}',
    extractedText.slice(0, 3000),
    100
  )
  try {
    const jsonMatch = result.match(/\{[\s\S]*\}/)
    return jsonMatch ? JSON.parse(jsonMatch[0]) : { category: 'report', confidence: 0.5 }
  } catch {
    return { category: 'report', confidence: 0.5 }
  }
}

export async function extractGoalsFromDoc(
  text: string
): Promise<
  Array<{
    title: string
    description: string
    quarter?: string
    target_metric?: string
    target_value?: number
  }>
> {
  const result = await callClaudeAgent(
    'Extract all business goals, KPIs, and milestones from this document. Reply with a JSON array only: [{"title":"...","description":"...","quarter":"...","target_metric":"...","target_value":0}]',
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
    `You are a professional debt recovery assistant for ${params.tenantName}. Draft a ${params.tone} payment reminder. Keep it under 250 characters for WhatsApp. Be firm but respectful. South African business context.`,
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
    `You are a world-class business advisor with deep knowledge of South African SME operations. Generate a concise daily brief. Be direct, data-driven, and actionable. Connect insights to company goals. Max 300 words.`,
    JSON.stringify(tenantData),
    600
  )
}
