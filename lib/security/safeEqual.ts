import { createHash, timingSafeEqual } from 'node:crypto'

/**
 * Constant-time string comparison for secrets and signatures. `===` / `!==` bail out
 * at the first differing byte, so response time leaks how much of a guess was right.
 * Both sides are hashed first so timingSafeEqual always sees equal-length buffers
 * (it throws on a length mismatch, which would itself leak the length).
 * Missing values never match — including two missing values.
 */
export function safeEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length === 0 || b.length === 0) return false
  return timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest())
}
