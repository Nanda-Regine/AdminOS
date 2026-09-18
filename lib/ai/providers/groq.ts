/**
 * Groq (OpenAI-compatible Chat Completions API). Free-tier alternative to
 * Claude for high-volume, low-stakes features — see costControls.ts's
 * getProviderForFeature() for which features route here.
 */

const GROQ_API_BASE = 'https://api.groq.com/openai/v1'
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'

export interface ProviderCallResult {
  text: string
  tokensIn: number
  tokensOut: number
}

export async function callGroq(
  systemPrompt: string,
  userMessage: string,
  maxTokens: number
): Promise<ProviderCallResult> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) throw new Error('[Groq] GROQ_API_KEY not set')

  const res = await fetch(`${GROQ_API_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const errObj = err as { error?: { message?: string } }
    throw new Error(`[Groq] API error ${res.status}: ${errObj.error?.message ?? res.statusText}`)
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>
    usage?: { prompt_tokens?: number; completion_tokens?: number }
  }

  return {
    text: data.choices?.[0]?.message?.content ?? '',
    tokensIn: data.usage?.prompt_tokens ?? 0,
    tokensOut: data.usage?.completion_tokens ?? 0,
  }
}
