/**
 * The business's legal and tax identity: industries, and validation of the SA
 * registration numbers that print on invoices, payslips and returns.
 *
 * Formats (checked 2026-10-06):
 *   VAT   10 digits starting with 4 (SARS VAT guides, e.g. "4123456789")
 *   PAYE  10 digits starting with 7 (SARS PAYE Employer Reconciliation BRS)
 *   SDL   "L" + 9 digits; UIF "U" + 9 digits (same BRS). For a PAYE number
 *         starting with 7, the SDL/UIF digits match the last 9 PAYE digits.
 *   CIPC  YYYY/NNNNNN/NN company registration number.
 *
 * No imports: tests load this file under node's strip-types mode.
 */

/** Mirrors the business_type enum (supabase migrations 20260817_business_type_extend). */
export const BUSINESS_TYPES = [
  { value: 'retail', label: 'Retail / shop' },
  { value: 'salons', label: 'Salon / beauty' },
  { value: 'trades', label: 'Trades / construction' },
  // Clinic and Legal are real enum values but not marketed: AdminOS lacks
  // ICD-10 / medical-scheme claims and s86 trust accounting (see the setup
  // wizard). Offered only to a tenant that already has one.
  { value: 'clinic', label: 'Clinic / healthcare', marketed: false },
  { value: 'school', label: 'School / education' },
  { value: 'ngo', label: 'NGO / non-profit' },
  { value: 'creative', label: 'Creative / media' },
  { value: 'consulting', label: 'Consulting / professional services' },
  { value: 'accounting', label: 'Accounting / bookkeeping' },
  { value: 'legal', label: 'Legal practice', marketed: false },
  { value: 'property', label: 'Property' },
  { value: 'logistics', label: 'Logistics / transport' },
  { value: 'events', label: 'Events' },
  { value: 'cleaning', label: 'Cleaning services' },
  { value: 'other', label: 'Other' },
] as const
/** Options for a picker: the marketed industries, plus `current` if it is one of the others. */
export function businessTypeOptions(current?: string | null) {
  return BUSINESS_TYPES.filter((b) => !('marketed' in b && b.marketed === false) || b.value === current)
}
export type BusinessTypeValue = (typeof BUSINESS_TYPES)[number]['value']
export const BUSINESS_TYPE_VALUES = BUSINESS_TYPES.map(b => b.value) as unknown as [BusinessTypeValue, ...BusinessTypeValue[]]

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] as const

/** Strip the spaces and dashes users paste in; upper-case letters. */
export const compact = (s: string) => s.replace(/[\s-]/g, '').toUpperCase()

export const isVatNumber = (s: string) => /^4\d{9}$/.test(compact(s))
export const isPayeRef = (s: string) => /^7\d{9}$/.test(compact(s))
export const isSdlRef = (s: string) => /^L\d{9}$/.test(compact(s))
export const isUifRef = (s: string) => /^U\d{9}$/.test(compact(s))
export const isIncomeTaxRef = (s: string) => /^\d{10}$/.test(compact(s))
export const isCipcNumber = (s: string) => /^(19|20)\d{2}\/\d{6}\/\d{2}$/.test(s.replace(/\s/g, ''))
export const isBranchCode = (s: string) => /^\d{6}$/.test(compact(s))
export const isBankAccount = (s: string) => /^\d{6,16}$/.test(compact(s))

/**
 * SDL and UIF numbers share the PAYE number's last 9 digits when PAYE starts
 * with 7. Returns a message when they disagree (a typo that SARS would reject).
 */
export function employerRefMismatch(paye?: string | null, sdl?: string | null, uif?: string | null): string | null {
  const p = paye ? compact(paye) : ''
  if (!/^7\d{9}$/.test(p)) return null
  const tail = p.slice(1)
  if (sdl && isSdlRef(sdl) && compact(sdl).slice(1) !== tail) return 'SDL number should end in the same 9 digits as your PAYE number.'
  if (uif && isUifRef(uif) && compact(uif).slice(1) !== tail) return 'UIF number should end in the same 9 digits as your PAYE number.'
  return null
}
