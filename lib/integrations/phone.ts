export type PhoneResult = {
  raw:         string
  e164:        string | null
  local:       string | null
  country:     string | null
  valid:       boolean
  type:        'mobile' | 'landline' | 'unknown'
  message:     string
}

// South Africa mobile prefixes (as of 2025)
const SA_MOBILE_PREFIXES = [
  '060','061','062','063','064','065','066','067','068','069',
  '071','072','073','074','075','076','077','078','079',
  '081','082','083','084','085','086','087',
]

export function validatePhone(raw: string): PhoneResult {
  const cleaned = raw.replace(/[\s\-().+]/g, '')

  // Detect country
  if (cleaned.startsWith('27') && cleaned.length === 11) {
    const local   = '0' + cleaned.slice(2)
    const prefix3 = local.slice(0, 3)
    const isMobile = SA_MOBILE_PREFIXES.includes(prefix3)
    return {
      raw,
      e164:    '+' + cleaned,
      local,
      country: 'ZA',
      valid:   true,
      type:    isMobile ? 'mobile' : 'landline',
      message: `Valid South African ${isMobile ? 'mobile' : 'landline'} number`,
    }
  }

  // SA local format: 0XX XXX XXXX (10 digits starting 0)
  if (cleaned.startsWith('0') && cleaned.length === 10 && /^\d+$/.test(cleaned)) {
    const e164     = '+27' + cleaned.slice(1)
    const prefix3  = cleaned.slice(0, 3)
    const isMobile = SA_MOBILE_PREFIXES.includes(prefix3)
    return {
      raw,
      e164,
      local:   cleaned,
      country: 'ZA',
      valid:   true,
      type:    isMobile ? 'mobile' : 'landline',
      message: `Valid South African ${isMobile ? 'mobile' : 'landline'} number`,
    }
  }

  // International E.164 format (+XX...)
  if (cleaned.startsWith('+') || /^\d{7,15}$/.test(cleaned)) {
    const digits = cleaned.replace(/^\+/, '')
    if (digits.length >= 7 && digits.length <= 15) {
      return {
        raw,
        e164:    '+' + digits,
        local:   null,
        country: null,
        valid:   true,
        type:    'unknown',
        message: 'International number — format looks valid',
      }
    }
  }

  return {
    raw,
    e164:    null,
    local:   null,
    country: null,
    valid:   false,
    type:    'unknown',
    message: 'Invalid phone number format',
  }
}
