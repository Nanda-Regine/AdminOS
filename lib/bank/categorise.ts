/**
 * Suggests a chart-of-accounts category (lib/finance/chartOfAccounts) for a bank
 * line. Pure — no imports — so tests load it directly. The keys below are the
 * stored keys of that chart; tests assert every one is valid.
 *
 * Order of authority:
 *   1. the tenant's own remembered corrections (bank_category_rules) — the
 *      owner said "Mr Price Hardware is cogs", so it stays cogs;
 *   2. the built-in South African keyword rules below;
 *   3. nothing — an honest "uncategorised" the owner can fix in one tap.
 *
 * A wrong silent guess poisons the books; an obvious blank does not. So
 * ambiguous lines (a supplier EFT, "Payment received") are left blank.
 */

export type BankDirection = 'in' | 'out'

export interface CategorySuggestion {
  key: string
  source: 'tenant_rule' | 'builtin'
}

interface Rule { re: RegExp; key: string }

const OUT_RULES: Rule[] = [
  { re: /\b(monthly )?(account|service|admin|card|maintenance|subscription) fee|bank charge|cash (deposit|handling) fee|fee[: -]|ib payment fee|acb (debit|credit) fee|swipe fee|speedpoint|yoco fee|snapscan fee|paystack fee|payfast fee/i, key: 'bank_charges' },
  { re: /\b(vodacom|mtn|telkom|cell ?c|rain|afrihost|vox|webafrica|openserve|fibre|airtime|data bundle)\b/i, key: 'telephone' },
  { re: /\b(eskom|city power|prepaid electricity|municipal|municipality|buffalo city|water & electricity|rates and taxes)\b/i, key: 'utilities' },
  { re: /\b(discovery|old mutual|sanlam|outsurance|santam|hollard|momentum|king price|miway|auto & general|insurance|assurance)\b/i, key: 'insurance' },
  { re: /\b(engen|shell|bp |sasol|caltex|total ?energies|astron|fuel|petrol|diesel|toll|sanral|e-?toll|car wash|tyre|tyres|auto ?zone|midas)\b/i, key: 'motor_vehicle' },
  { re: /\b(salary|salaries|wages|payroll|uif|sdl)\b/i, key: 'salaries' },
  { re: /\b(rent|lease|rental)\b/i, key: 'rent' },
  { re: /\b(google|microsoft|adobe|canva|zoom|xero|shopify|github|vercel|openai|anthropic|dropbox|notion|slack|apple\.com|icloud|netlify|cloudflare|godaddy|domain)\b/i, key: 'subscriptions' },
  { re: /\b(facebook ads|meta ads|fb ads|google ads|instagram|tiktok ads|linkedin ads|advert|billboard|flyer|promo)\b/i, key: 'marketing' },
  { re: /\b(waltons|stationery|printing|print shop|cartridge|toner|ink)\b/i, key: 'stationery' },
  { re: /\b(accountant|accounting|attorney|lawyer|legal|cipc|bookkeep|audit fee|consultant)\b/i, key: 'professional' },
  { re: /\b(uber|bolt|flysafair|airlink|kulula|lift|intercape|greyhound|citybug|taxi|gautrain)\b/i, key: 'travel' },
  { re: /\b(kfc|nando'?s|steers|wimpy|mcdonald'?s|spur|debonairs|ocean basket|restaurant|coffee|vida e caffe|mugg)\b/i, key: 'meals' },
  { re: /\b(hotel|guest ?house|airbnb|booking\.com|lodge|b&b)\b/i, key: 'accommodation' },
  { re: /\b(training|course|workshop|seta|udemy|academy)\b/i, key: 'training' },
  { re: /\b(repair|repairs|maintenance|plumber|electrician)\b/i, key: 'repairs' },
  { re: /\b(donation|tithe|charity|ngo)\b/i, key: 'donations' },
]

const IN_RULES: Rule[] = [
  { re: /\b(interest (credit|received|earned|capitalised)|int(erest)? earned|credit interest)\b/i, key: 'interest' },
  { re: /\b(grant|donation received|funding)\b/i, key: 'grants' },
  { re: /\b(rental income|rent received|tenant)\b/i, key: 'rental' },
  { re: /\b(membership|subscription received|monthly fee received)\b/i, key: 'membership' },
]

/** Bank boilerplate that says how the money moved, not who it moved to. */
const NOISE = /\b(fnb app|fnb|absa|capitec|nedbank|standard bank|tyme ?bank|payment to|payment from|payment received|rtc credit|pos purchase|card purchase|debit order|ib payment|immediate payment|instant payment|eft|transfer|cash deposit|cashsend|send money|purchase|credit|debit|ref|reference)\b/gi

/**
 * A stable, human-meaningful key for "who is this" — used to remember the
 * owner's categorisation. "POS Purchase Engen East London 4821" and
 * "POS Purchase Engen East London 9930" must collapse to the same vendor.
 */
export function vendorKey(description: string): string {
  const words = description
    .toLowerCase()
    .replace(/[0-9]{3,}/g, ' ') // card tails, reference numbers, long codes
    .replace(NOISE, ' ')
    .replace(/[^a-z&' ]+/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1)
  return words.slice(0, 3).join(' ')
}

export interface TenantRule { match_text: string; category: string; direction: BankDirection }

export function suggestCategory(
  description: string,
  direction: BankDirection,
  tenantRules: readonly TenantRule[] = [],
): CategorySuggestion | null {
  const vk = vendorKey(description)
  if (vk) {
    const remembered = tenantRules.find((r) => r.direction === direction && r.match_text === vk)
    if (remembered) return { key: remembered.category, source: 'tenant_rule' }
  }
  const rules = direction === 'out' ? OUT_RULES : IN_RULES
  for (const r of rules) if (r.re.test(description)) return { key: r.key, source: 'builtin' }
  return null
}
