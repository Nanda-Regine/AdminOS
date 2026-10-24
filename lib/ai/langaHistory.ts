/**
 * Langa conversation history — bounded and sanitised before it reaches the model.
 *
 * The client re-sends the whole chat on every request, so history is untrusted
 * input: its size sets the real input-token cost of a call, and client-supplied
 * `assistant` turns are a prefill-style injection route. Pure (no I/O) so it is
 * unit-tested without Anthropic or Redis.
 */

import { sanitizeForAI } from '../security/sanitize.ts'

export interface HistoryTurn { role: 'user' | 'assistant'; content: string }

/** Turns kept, newest first. */
export const MAX_HISTORY_TURNS = 20
/** Total characters of history sent to the model (~3k tokens). */
export const MAX_HISTORY_CHARS = 10_000

/** Conservative: SA multilingual text tokenises worse than English's ~4 chars/token. */
export const estimateTokens = (chars: number): number => Math.ceil(chars / 3)

/**
 * Sanitise every turn, keep the newest turns that fit the character budget,
 * and drop leading assistant turns so a forged opener can't steer the reply.
 */
export function prepareHistory(history: HistoryTurn[]): HistoryTurn[] {
  const kept: HistoryTurn[] = []
  let chars = 0
  for (const turn of history.slice(-MAX_HISTORY_TURNS).reverse()) {
    const content = sanitizeForAI(turn.content)
    if (!content) continue
    if (chars + content.length > MAX_HISTORY_CHARS) break
    chars += content.length
    kept.push({ role: turn.role, content })
  }
  kept.reverse()
  while (kept.length && kept[0].role === 'assistant') kept.shift()
  return kept
}

/** Output allowance (`max_tokens`) plus the system prompt (context block + persona). */
const REPLY_TOKENS = 800
const SYSTEM_TOKENS = 1500

/** Tokens a Langa call can cost, for the pre-flight `checkBudget`. */
export function estimateLangaTokens(history: HistoryTurn[], message: string): number {
  const chars = history.reduce((n, t) => n + t.content.length, 0) + message.length
  return SYSTEM_TOKENS + estimateTokens(chars) + REPLY_TOKENS
}
