/**
 * A lightweight chart of accounts — not a general ledger. Gives every sale
 * and expense a real, structured category from day one (instead of free
 * text) so the existing accountant-ready exports (lib/money/exports.ts)
 * can break revenue and spend down properly, and a new business's books
 * are in order without anyone having to know what a chart of accounts is.
 *
 * No debits/credits, no trial balance — categorization only. See
 * lib/money/exports.ts's own header comment: AdminOS exports clean coded
 * working papers, it is not the system of record.
 */

export type AccountKind = 'income' | 'expense'

export interface Account {
  /** Stable slug stored on invoices.category / expenses.category. */
  key: string
  /** Simplified GL-style code, reused from the account numbers already
   *  hardcoded into lib/money/exports.ts's journal CSV (Sales 4000, VAT
   *  Control 2200, etc.) so the two stay consistent. */
  code: string
  label: string
}

export const INCOME_ACCOUNTS: Account[] = [
  { key: 'sales',        code: '4000', label: 'Sales / Product Revenue' },
  { key: 'service',      code: '4010', label: 'Service Income' },
  { key: 'rental',       code: '4020', label: 'Rental Income' },
  { key: 'membership',   code: '4030', label: 'Membership / Subscription Fees' },
  { key: 'grants',       code: '4040', label: 'Grants & Donations' },
  { key: 'interest',     code: '4050', label: 'Interest Income' },
  { key: 'other_income', code: '4090', label: 'Other Income' },
]

// Keys for the first 5 (travel, meals, equipment, accommodation, other) are
// unchanged from the original CreateExpenseModal list so existing expense
// rows keep resolving to the same category without a data migration.
export const EXPENSE_ACCOUNTS: Account[] = [
  { key: 'cogs',          code: '5000', label: 'Cost of Goods Sold' },
  { key: 'salaries',      code: '6000', label: 'Salaries & Wages' },
  { key: 'rent',          code: '6010', label: 'Rent' },
  { key: 'utilities',     code: '6020', label: 'Utilities' },
  { key: 'telephone',     code: '6030', label: 'Telephone & Internet' },
  { key: 'insurance',     code: '6040', label: 'Insurance' },
  { key: 'bank_charges',  code: '6050', label: 'Bank Charges' },
  { key: 'professional',  code: '6060', label: 'Professional Fees' },
  { key: 'marketing',     code: '6070', label: 'Marketing & Advertising' },
  { key: 'travel',        code: '6080', label: 'Travel' },
  { key: 'motor_vehicle', code: '6090', label: 'Motor Vehicle Expenses' },
  { key: 'repairs',       code: '6100', label: 'Repairs & Maintenance' },
  { key: 'stationery',    code: '6110', label: 'Stationery & Printing' },
  { key: 'subscriptions', code: '6120', label: 'Subscriptions & Software' },
  { key: 'equipment',     code: '6130', label: 'Equipment' },
  { key: 'accommodation', code: '6140', label: 'Accommodation' },
  { key: 'meals',         code: '6150', label: 'Meals & Entertainment' },
  { key: 'training',      code: '6160', label: 'Training & Development' },
  { key: 'donations',     code: '6170', label: 'Donations Given' },
  { key: 'other',         code: '6900', label: 'Other Expenses' },
]

export const DEFAULT_INCOME_KEY  = 'sales'
export const DEFAULT_EXPENSE_KEY = 'other'

const byKey = (kind: AccountKind) =>
  new Map((kind === 'income' ? INCOME_ACCOUNTS : EXPENSE_ACCOUNTS).map(a => [a.key, a]))

export function accountFor(kind: AccountKind, key: string | null | undefined): Account {
  const map = byKey(kind)
  return map.get(key ?? '') ?? map.get(kind === 'income' ? DEFAULT_INCOME_KEY : DEFAULT_EXPENSE_KEY)!
}

export function labelFor(kind: AccountKind, key: string | null | undefined): string {
  return accountFor(kind, key).label
}

export function codeFor(kind: AccountKind, key: string | null | undefined): string {
  return accountFor(kind, key).code
}

export function isValidKey(kind: AccountKind, key: string): boolean {
  return byKey(kind).has(key)
}

/** A sensible default income category per business_type, for the Quick Sale form. */
export function defaultIncomeKeyForBusinessType(businessType: string | null | undefined): string {
  switch (businessType) {
    case 'property':                        return 'rental'
    case 'ngo':                              return 'grants'
    case 'school':                           return 'membership'
    case 'consulting': case 'legal':
    case 'accounting': case 'trades':
    case 'creative': case 'cleaning':        return 'service'
    default:                                 return 'sales'
  }
}

export const PAYMENT_METHODS: { key: string; label: string }[] = [
  { key: 'cash',         label: 'Cash' },
  { key: 'card',         label: 'Card' },
  { key: 'eft',          label: 'EFT / Bank transfer' },
  { key: 'mobile_money', label: 'Mobile money (SnapScan / Zapper / etc.)' },
  { key: 'other',        label: 'Other' },
]
