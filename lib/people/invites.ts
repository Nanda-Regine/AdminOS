/**
 * Staff app invite codes — how an employee gets a login.
 *
 * Email can't carry invites (no working sender, and many employees in our
 * market have WhatsApp but no email), so the owner shares a one-time code over
 * WhatsApp and the employee redeems it in the app. Only the SHA-256 of a code
 * is stored. Codes are 8 characters from a 32-symbol alphabet with no 0/O/1/I
 * (40 bits); redemption is rate-limited per IP, so guessing one is infeasible.
 *
 * Employees without an email get a generated login on a domain we own that
 * never receives mail. They recover access the same way they got it: the
 * employer sends a fresh invite, which resets the password on redemption.
 *
 * Pure helpers only (no imports beyond node:crypto) so tests load this directly.
 */

import { createHash, randomInt } from 'node:crypto'

export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const INVITE_TTL_DAYS = 7
export const GENERATED_LOGIN_DOMAIN = 'staff.adminos.co.za'

export function generateInviteCode(): string {
  let raw = ''
  for (let i = 0; i < 8; i++) raw += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]
  return `${raw.slice(0, 4)}-${raw.slice(4)}`
}

/** Accepts "abcd-efgh", "ABCD EFGH", "abcdefgh". Null when it can't be a code. */
export function normaliseInviteCode(input: string): string | null {
  const raw = input.toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (raw.length !== 8) return null
  for (const ch of raw) if (!CODE_ALPHABET.includes(ch)) return null
  return `${raw.slice(0, 4)}-${raw.slice(4)}`
}

export function hashInviteCode(code: string): string {
  return createHash('sha256').update(code).digest('hex')
}

/** A login for an employee with no email: "thandi.k7p2@staff.adminos.co.za". */
export function generatedLoginEmail(fullName: string): string {
  const first = (fullName.trim().split(/\s+/)[0] ?? 'staff')
    .normalize('NFKD').replace(/[^a-zA-Z]/g, '').toLowerCase().slice(0, 20) || 'staff'
  let suffix = ''
  for (let i = 0; i < 4; i++) suffix += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)].toLowerCase()
  return `${first}.${suffix}@${GENERATED_LOGIN_DOMAIN}`
}

/**
 * Minimum password rule for a login that sees payslips and bank details: 8+
 * characters with a letter and a digit, and not one of the passwords every
 * credential-stuffing list starts with.
 */
const COMMON = new Set(['password1', 'password123', 'qwerty123', '12345678a', 'abc12345', 'admin123', 'welcome1', 'letmein1', 'iloveyou1', 'passw0rd'])
export function passwordProblem(pw: string): string | null {
  if (pw.length < 8) return 'Use at least 8 characters.'
  if (pw.length > 72) return 'Use at most 72 characters.'
  if (!/[a-zA-Z]/.test(pw) || !/\d/.test(pw)) return 'Use at least one letter and one number.'
  if (COMMON.has(pw.toLowerCase())) return 'That password is too common — choose another.'
  return null
}

/** SA mobile → wa.me digits. "082 123 4567" → "27821234567". Null if not a phone. */
export function waDigits(phone: string | null | undefined): string | null {
  if (!phone) return null
  let d = phone.replace(/\D/g, '')
  if (d.startsWith('00')) d = d.slice(2)
  if (d.startsWith('0') && d.length === 10) d = `27${d.slice(1)}`
  return d.length >= 10 && d.length <= 15 ? d : null
}
