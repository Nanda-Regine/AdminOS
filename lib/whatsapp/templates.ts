/**
 * AdminOS WhatsApp Template Registry
 *
 * All template names must be submitted for approval in Meta Business Suite
 * before outbound messaging works outside the 24-hour customer service window.
 * Free-form messages only work within the 24-hour window.
 *
 * To submit: Meta Business Suite → WhatsApp → Message Templates → Create Template
 */

export const WHATSAPP_TEMPLATES = {
  // Debt recovery sequence (5 tiers — progressively escalating)
  DEBT_TIER_1_FRIENDLY: 'adminos_debt_tier1_friendly',
  DEBT_TIER_2_FOLLOWUP: 'adminos_debt_tier2_followup',
  DEBT_TIER_3_FIRM:     'adminos_debt_tier3_firm',
  DEBT_TIER_4_FINAL:    'adminos_debt_tier4_final',
  DEBT_TIER_5_DEMAND:   'adminos_debt_tier5_demand',

  // Wellness check-ins (Care agent)
  WELLNESS_CHECKIN:     'adminos_wellness_checkin',
  WELLNESS_SUPPORT:     'adminos_wellness_support',

  // Operational
  DAILY_BRIEF_READY:    'adminos_brief_ready',
  ONBOARDING_WELCOME:   'adminos_onboarding_welcome',
  INVOICE_CONFIRMATION: 'adminos_invoice_sent',
} as const

export type WhatsAppTemplate = typeof WHATSAPP_TEMPLATES[keyof typeof WHATSAPP_TEMPLATES]
