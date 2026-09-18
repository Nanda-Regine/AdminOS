/**
 * Google Gemini (Generative Language API, API-key auth — the free-tier
 * AI Studio path, not Vertex AI). Free-tier alternative to Claude for
 * high-volume, low-stakes features — see costControls.ts's
 * getProviderForFeature() for which features route here.
 *
 * Uses GEMINI_API_KEY as a plain API key against
 * generativelanguage.googleapis.com. If the key in .env.local turns out to
 * be a Vertex AI / service-account credential instead, this call will 401
 * and needs swapping to Vertex's OAuth2 flow — a materially different
 * integration, not a config tweak.
 */

import type { ProviderCallResult } from './groq'

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash'

export async function callGemini(
  systemPrompt: string,
  userMessage: string,
  maxTokens: number
): Promise<ProviderCallResult> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('[Gemini] GEMINI_API_KEY not set')

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userMessage }] }],
        generationConfig: { maxOutputTokens: maxTokens },
      }),
    }
  )

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const errObj = err as { error?: { message?: string } }
    throw new Error(`[Gemini] API error ${res.status}: ${errObj.error?.message ?? res.statusText}`)
  }

  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number }
  }

  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''

  return {
    text,
    tokensIn: data.usageMetadata?.promptTokenCount ?? 0,
    tokensOut: data.usageMetadata?.candidatesTokenCount ?? 0,
  }
}
