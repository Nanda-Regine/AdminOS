/**
 * Expense categories an employee can claim — a subset of the web app's chart
 * of accounts (lib/finance/chartOfAccounts.ts EXPENSE_ACCOUNTS). The API
 * rejects keys that aren't in the chart, so these must stay real keys.
 */
export const CLAIM_CATEGORIES: { key: string; label: string }[] = [
  { key: 'travel',        label: 'Travel' },
  { key: 'motor_vehicle', label: 'Fuel & vehicle' },
  { key: 'meals',         label: 'Meals' },
  { key: 'accommodation', label: 'Accommodation' },
  { key: 'stationery',    label: 'Stationery & printing' },
  { key: 'telephone',     label: 'Airtime & data' },
  { key: 'equipment',     label: 'Equipment' },
  { key: 'repairs',       label: 'Repairs' },
  { key: 'training',      label: 'Training' },
  { key: 'other',         label: 'Other' },
]

const ALL: Record<string, string> = {
  cogs: 'Cost of goods', salaries: 'Salaries', rent: 'Rent', utilities: 'Utilities', insurance: 'Insurance',
  bank_charges: 'Bank charges', professional: 'Professional fees', marketing: 'Marketing', subscriptions: 'Subscriptions',
  donations: 'Donations',
  ...Object.fromEntries(CLAIM_CATEGORIES.map((c) => [c.key, c.label])),
}

export function categoryLabel(key: string | null | undefined): string {
  if (!key) return 'Other'
  return ALL[key] ?? key.replace(/_/g, ' ')
}
