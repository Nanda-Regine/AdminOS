/**
 * Prompt injection protection for AdminOS AI agents.
 *
 * AdminOS processes external user messages (WhatsApp inbound).
 * These are user-controlled inputs and MUST be sanitized before
 * passing to any AI model to prevent prompt injection attacks.
 */

const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+)?previous\s+instructions?/gi,
  /ignore\s+(your\s+)?system\s+prompt/gi,
  /you\s+are\s+now\s+(a\s+)?/gi,
  /forget\s+(your\s+)?(previous\s+)?(instructions?|prompt|context)/gi,
  /new\s+instructions?\s*:/gi,
  /\[SYSTEM\]/gi,
  /\[INST\]/gi,
  /<<SYS>>/gi,
  /act\s+as\s+(if\s+you\s+are\s+)?/gi,
  /disregard\s+(your\s+)?(previous\s+)?instructions?/gi,
  /override\s+(your\s+)?(system\s+)?(prompt|instructions?)/gi,
  /you\s+must\s+now\s+/gi,
  /pretend\s+(you\s+are|to\s+be)\s+/gi,
  /roleplay\s+as\s+/gi,
  /jailbreak/gi,
  /DAN\s+mode/gi,
  /developer\s+mode/gi,
]

const MAX_MESSAGE_LENGTH = 2000

/**
 * Sanitize a user-supplied message before passing it to an AI agent.
 * Strips known prompt injection patterns and enforces a hard length limit.
 *
 * @param input - Raw user message from WhatsApp or any external source
 * @returns Sanitized message safe for inclusion in AI context
 */
export function sanitizeForAI(input: string): string {
  if (typeof input !== 'string') return ''

  let sanitized = input

  for (const pattern of INJECTION_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[filtered]')
  }

  // Hard character limit — prevent token stuffing attacks
  return sanitized.slice(0, MAX_MESSAGE_LENGTH)
}

/**
 * Sanitize a tenant-supplied configuration value (e.g. business name, product name)
 * before injecting it into a system prompt. Less aggressive than sanitizeForAI
 * since these are admin-provided, but still protect against injection.
 */
export function sanitizeSystemPromptValue(value: string, maxLength = 500): string {
  if (typeof value !== 'string') return ''

  const cleaned = value
    .replace(/\[SYSTEM\]/gi, '')
    .replace(/<<SYS>>/gi, '')
    .replace(/\[INST\]/gi, '')
    // Remove control characters
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')

  return cleaned.slice(0, maxLength)
}

/**
 * Sanitize extracted document text before passing to an AI agent.
 * Same injection pattern stripping as sanitizeForAI but without the 2,000
 * character limit — documents have their own 80k limit in the file parser.
 * Fixes: security audit finding — document text passed to Claude unsanitized.
 *
 * @param text - Raw extracted text from PDF/DOCX/XLSX/etc.
 * @returns Sanitized text safe for inclusion in AI document analysis
 */
export function sanitizeDocumentText(text: string): string {
  if (typeof text !== 'string') return ''

  let sanitized = text
  for (const pattern of INJECTION_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[filtered]')
  }
  return sanitized
}

/**
 * Validate that a tenant ID header value is safe to use as a DB identifier.
 * Prevents header injection into Supabase queries.
 */
export function validateTenantId(tenantId: string | null): string | null {
  if (!tenantId) return null
  // UUIDs only — reject anything that isn't a valid UUID format
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return UUID_RE.test(tenantId) ? tenantId : null
}
