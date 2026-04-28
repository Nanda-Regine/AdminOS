/**
 * AdminOS WhatsApp Template Registry
 *
 * All template names must be submitted for approval in Meta Business Suite
 * before outbound messaging works outside the 24-hour customer service window.
 * Free-form messages only work within the 24-hour window.
 *
 * To submit: Meta Business Suite → WhatsApp → Message Templates → Create Template
 *
 * Template naming convention: adminos_<category>_<action>
 */

export const WHATSAPP_TEMPLATES = {
  // ── Debt recovery (5 escalating tiers) ────────────────────────────────────
  DEBT_TIER_1_FRIENDLY:   'adminos_debt_tier1_friendly',
  DEBT_TIER_2_FOLLOWUP:   'adminos_debt_tier2_followup',
  DEBT_TIER_3_FIRM:       'adminos_debt_tier3_firm',
  DEBT_TIER_4_FINAL:      'adminos_debt_tier4_final',
  DEBT_TIER_5_DEMAND:     'adminos_debt_tier5_demand',

  // ── Staff wellness (Care agent) ────────────────────────────────────────────
  WELLNESS_CHECKIN:       'adminos_wellness_checkin',
  WELLNESS_SUPPORT:       'adminos_wellness_support',
  WELLNESS_BURNOUT_ALERT: 'adminos_wellness_burnout_alert',
  WELLNESS_MONTHLY_PULSE: 'adminos_wellness_monthly_pulse',

  // ── Appointments & scheduling ──────────────────────────────────────────────
  APPOINTMENT_REMINDER_24H:  'adminos_appt_reminder_24h',
  APPOINTMENT_REMINDER_1H:   'adminos_appt_reminder_1h',
  APPOINTMENT_CONFIRMED:     'adminos_appt_confirmed',
  APPOINTMENT_RESCHEDULE:    'adminos_appt_reschedule',
  APPOINTMENT_CANCELLED:     'adminos_appt_cancelled',

  // ── Invoices & payments ────────────────────────────────────────────────────
  INVOICE_SENT:              'adminos_invoice_sent',
  INVOICE_PAYMENT_RECEIVED:  'adminos_payment_received',
  INVOICE_OVERDUE_NOTICE:    'adminos_invoice_overdue',
  INVOICE_PARTIAL_PAYMENT:   'adminos_partial_payment',
  INVOICE_STATEMENT_MONTHLY: 'adminos_statement_monthly',

  // ── Quotes & proposals ────────────────────────────────────────────────────
  QUOTE_SENT:                'adminos_quote_sent',
  QUOTE_FOLLOWUP_48H:        'adminos_quote_followup_48h',
  QUOTE_FOLLOWUP_7D:         'adminos_quote_followup_7d',
  QUOTE_EXPIRING:            'adminos_quote_expiring',
  QUOTE_ACCEPTED:            'adminos_quote_accepted',

  // ── Client onboarding ─────────────────────────────────────────────────────
  ONBOARDING_WELCOME:        'adminos_onboarding_welcome',
  ONBOARDING_STEP_COMPLETE:  'adminos_onboarding_step',
  ONBOARDING_DOCS_REQUEST:   'adminos_docs_request',

  // ── Documents ─────────────────────────────────────────────────────────────
  DOCUMENT_REQUEST:          'adminos_document_request',
  DOCUMENT_RECEIVED:         'adminos_document_received',
  DOCUMENT_EXPIRING:         'adminos_document_expiring',
  CONTRACT_RENEWAL:          'adminos_contract_renewal',

  // ── Service delivery ──────────────────────────────────────────────────────
  JOB_STARTED:               'adminos_job_started',
  JOB_COMPLETED:             'adminos_job_completed',
  JOB_DELAYED:               'adminos_job_delayed',
  DELIVERY_SCHEDULED:        'adminos_delivery_scheduled',
  DELIVERY_COMPLETED:        'adminos_delivery_completed',

  // ── Customer engagement ───────────────────────────────────────────────────
  SATISFACTION_SURVEY:       'adminos_satisfaction_survey',
  REFERRAL_REQUEST:          'adminos_referral_request',
  RE_ENGAGEMENT_30D:         'adminos_re_engagement_30d',
  RE_ENGAGEMENT_90D:         'adminos_re_engagement_90d',
  SEASONAL_PROMO:            'adminos_seasonal_promo',

  // ── Owner / admin alerts ──────────────────────────────────────────────────
  DAILY_BRIEF_READY:         'adminos_brief_ready',
  ESCALATION_ALERT:          'adminos_escalation_alert',
  PAYMENT_ALERT:             'adminos_payment_alert',
  NEW_CLIENT_ALERT:          'adminos_new_client_alert',
  STAFF_CONCERN_ALERT:       'adminos_staff_concern_alert',
  GOAL_ACHIEVED:             'adminos_goal_achieved',
} as const

export type WhatsAppTemplate = typeof WHATSAPP_TEMPLATES[keyof typeof WHATSAPP_TEMPLATES]

/**
 * Template body text for Meta Business Suite submission.
 * Variables use {{1}}, {{2}} notation.
 */
export const TEMPLATE_BODIES: Record<WhatsAppTemplate, string> = {
  // Debt tiers
  [WHATSAPP_TEMPLATES.DEBT_TIER_1_FRIENDLY]:
    'Hi {{1}}, just a friendly reminder that invoice #{{2}} for R{{3}} was due on {{4}}. If you\'ve already paid, please ignore this message. You can pay securely at {{5}}. Thank you!',
  [WHATSAPP_TEMPLATES.DEBT_TIER_2_FOLLOWUP]:
    'Hi {{1}}, we noticed invoice #{{2}} (R{{3}}) is now {{4}} days overdue. We\'d love to help you settle this — please get in touch if you\'d like to arrange a payment plan. Pay now: {{5}}',
  [WHATSAPP_TEMPLATES.DEBT_TIER_3_FIRM]:
    'Dear {{1}}, invoice #{{2}} for R{{3}} is now significantly overdue. Please arrange payment within 5 business days to avoid further action. Contact us: {{4}} or pay at: {{5}}',
  [WHATSAPP_TEMPLATES.DEBT_TIER_4_FINAL]:
    'Dear {{1}}, this is a final notice for invoice #{{2}} (R{{3}}). Payment is required within 48 hours. Failure to pay may result in legal proceedings. Please contact {{4}} immediately.',
  [WHATSAPP_TEMPLATES.DEBT_TIER_5_DEMAND]:
    'FORMAL DEMAND: {{1}}, you owe R{{2}} per invoice #{{3}}. A letter of demand has been issued. Legal proceedings begin in 5 days unless payment or arrangement is made. Ref: {{4}}',

  // Wellness
  [WHATSAPP_TEMPLATES.WELLNESS_CHECKIN]:
    'Hi {{1}} 👋 Quick check-in from {{2}}. How are you feeling today? Reply 1-5 (1=struggling, 5=great). Your response is private and helps us support you better.',
  [WHATSAPP_TEMPLATES.WELLNESS_SUPPORT]:
    'Hi {{1}}, we noticed you\'ve been having a tough time. Your manager {{2}} cares about your wellbeing. Would you like to schedule a private chat? Reply YES or call {{3}}.',
  [WHATSAPP_TEMPLATES.WELLNESS_BURNOUT_ALERT]:
    '{{1}}, your recent check-ins suggest you may be under significant stress. We\'d like to help. Please reach out to {{2}} or take a look at our support resources: {{3}}',
  [WHATSAPP_TEMPLATES.WELLNESS_MONTHLY_PULSE]:
    'Monthly wellness pulse for {{1}} 🌿 How has this month been overall? Rate 1-10 and share one win or one challenge. Your team appreciates your honesty.',

  // Appointments
  [WHATSAPP_TEMPLATES.APPOINTMENT_REMINDER_24H]:
    'Hi {{1}}, reminder: your appointment with {{2}} is tomorrow at {{3}}. Location: {{4}}. Reply CONFIRM or RESCHEDULE.',
  [WHATSAPP_TEMPLATES.APPOINTMENT_REMINDER_1H]:
    'Hi {{1}}, your appointment with {{2}} starts in 1 hour ({{3}}). See you soon at {{4}}! Reply if you need to reach us.',
  [WHATSAPP_TEMPLATES.APPOINTMENT_CONFIRMED]:
    'Hi {{1}} ✓ Your appointment is confirmed for {{2}} at {{3}} with {{4}}. We\'ll send a reminder 24h before. See you then!',
  [WHATSAPP_TEMPLATES.APPOINTMENT_RESCHEDULE]:
    'Hi {{1}}, we need to reschedule your appointment originally set for {{2}}. Please choose a new time at {{3}} or reply with your availability.',
  [WHATSAPP_TEMPLATES.APPOINTMENT_CANCELLED]:
    'Hi {{1}}, your appointment on {{2}} has been cancelled as requested. To rebook, visit {{3}} or reply to this message. We hope to see you soon.',

  // Invoices
  [WHATSAPP_TEMPLATES.INVOICE_SENT]:
    'Hi {{1}}, invoice #{{2}} for R{{3}} has been sent to {{4}}. Due date: {{5}}. View & pay securely: {{6}}',
  [WHATSAPP_TEMPLATES.INVOICE_PAYMENT_RECEIVED]:
    'Payment received ✓ Thank you {{1}}! We\'ve received R{{2}} for invoice #{{3}}. Your receipt has been emailed to {{4}}. We appreciate your business!',
  [WHATSAPP_TEMPLATES.INVOICE_OVERDUE_NOTICE]:
    'Hi {{1}}, invoice #{{2}} (R{{3}}) was due on {{4}} and remains unpaid. Please settle this to avoid late fees. Pay now: {{5}}',
  [WHATSAPP_TEMPLATES.INVOICE_PARTIAL_PAYMENT]:
    'Hi {{1}}, we received your partial payment of R{{2}} on invoice #{{3}}. Outstanding balance: R{{4}}. Please settle by {{5}}. Thank you!',
  [WHATSAPP_TEMPLATES.INVOICE_STATEMENT_MONTHLY]:
    'Hi {{1}}, your monthly statement for {{2}} is ready. Total outstanding: R{{3}} across {{4}} invoices. View full statement: {{5}}',

  // Quotes
  [WHATSAPP_TEMPLATES.QUOTE_SENT]:
    'Hi {{1}}, your quote #{{2}} from {{3}} is ready! Total: R{{4}}. Valid until: {{5}}. View & accept: {{6}}',
  [WHATSAPP_TEMPLATES.QUOTE_FOLLOWUP_48H]:
    'Hi {{1}}, just checking in on quote #{{2}} (R{{3}}) we sent 2 days ago. Any questions? We\'re happy to adjust. View quote: {{4}}',
  [WHATSAPP_TEMPLATES.QUOTE_FOLLOWUP_7D]:
    'Hi {{1}}, quote #{{2}} is still available for R{{3}} and expires on {{4}}. Would you like to proceed or discuss? Reply here or call {{5}}.',
  [WHATSAPP_TEMPLATES.QUOTE_EXPIRING]:
    'Hi {{1}}, your quote #{{2}} (R{{3}}) expires in 48 hours on {{4}}. Accept now to lock in this price: {{5}}',
  [WHATSAPP_TEMPLATES.QUOTE_ACCEPTED]:
    'Quote accepted ✓ Excellent, {{1}}! Quote #{{2}} for R{{3}} has been accepted. We\'ll be in touch with next steps. Thank you for choosing {{4}}!',

  // Onboarding
  [WHATSAPP_TEMPLATES.ONBOARDING_WELCOME]:
    'Welcome to {{1}}, {{2}}! 🎉 Your account is active. Here\'s how to get started: {{3}}. Our team is here if you need anything — just reply to this message.',
  [WHATSAPP_TEMPLATES.ONBOARDING_STEP_COMPLETE]:
    'Great progress, {{1}}! You\'ve completed step {{2}} of {{3}} in your setup. Next step: {{4}}. Keep going — you\'re almost live!',
  [WHATSAPP_TEMPLATES.ONBOARDING_DOCS_REQUEST]:
    'Hi {{1}}, to complete your onboarding we need the following documents: {{2}}. Please upload them at {{3}} or reply to this message. Thank you!',

  // Documents
  [WHATSAPP_TEMPLATES.DOCUMENT_REQUEST]:
    'Hi {{1}}, we require {{2}} from you to proceed. Please send it to {{3}} or upload at {{4}}. Deadline: {{5}}. Thank you!',
  [WHATSAPP_TEMPLATES.DOCUMENT_RECEIVED]:
    '{{1}} received ✓ Hi {{2}}, we\'ve received your {{3}} and it\'s being processed. We\'ll confirm within {{4}} business days.',
  [WHATSAPP_TEMPLATES.DOCUMENT_EXPIRING]:
    'Important: Hi {{1}}, your {{2}} expires on {{3}}. Please renew it before expiry to avoid service interruption. Need help? Contact {{4}}.',
  [WHATSAPP_TEMPLATES.CONTRACT_RENEWAL]:
    'Hi {{1}}, your contract with {{2}} is due for renewal on {{3}}. To continue uninterrupted service, please review and sign the renewal: {{4}}',

  // Service delivery
  [WHATSAPP_TEMPLATES.JOB_STARTED]:
    'Hi {{1}}, great news! Your job #{{2}} has started today. Our team is on-site at {{3}}. Estimated completion: {{4}}. We\'ll keep you updated.',
  [WHATSAPP_TEMPLATES.JOB_COMPLETED]:
    'Job complete ✓ Hi {{1}}, your job #{{2}} has been completed successfully on {{3}}. Please rate your experience: {{4}}. Thank you for choosing {{5}}!',
  [WHATSAPP_TEMPLATES.JOB_DELAYED]:
    'Hi {{1}}, we regret to inform you that job #{{2}} has been delayed. New estimated completion: {{3}}. Reason: {{4}}. We apologise for any inconvenience.',
  [WHATSAPP_TEMPLATES.DELIVERY_SCHEDULED]:
    'Hi {{1}}, your delivery is scheduled for {{2}} between {{3}} and {{4}}. Tracking ref: {{5}}. Reply RESCHEDULE if this doesn\'t work.',
  [WHATSAPP_TEMPLATES.DELIVERY_COMPLETED]:
    'Delivered ✓ Hi {{1}}, your order #{{2}} was delivered on {{3}}. If anything is wrong, reply within 24h. Thank you for your business!',

  // Customer engagement
  [WHATSAPP_TEMPLATES.SATISFACTION_SURVEY]:
    'Hi {{1}}, how did we do? Rate your recent experience with {{2}} from 1-5 ⭐. Your feedback takes 30 seconds and helps us serve you better: {{3}}',
  [WHATSAPP_TEMPLATES.REFERRAL_REQUEST]:
    'Hi {{1}}, if you\'re happy with {{2}}, we\'d love a referral! Share this link with a friend and you\'ll both get {{3}} off your next invoice: {{4}}',
  [WHATSAPP_TEMPLATES.RE_ENGAGEMENT_30D]:
    'Hi {{1}}, we miss you! It\'s been a month since your last visit to {{2}}. We\'ve got something new for you — check it out: {{3}}',
  [WHATSAPP_TEMPLATES.RE_ENGAGEMENT_90D]:
    'Hi {{1}}, it\'s been a while! {{2}} has some exciting updates. Come back and see what\'s new, or let us know how we can serve you better: {{3}}',
  [WHATSAPP_TEMPLATES.SEASONAL_PROMO]:
    'Hi {{1}}, {{2}} special offer just for you! {{3}} — valid until {{4}}. Claim now: {{5}}. Terms apply.',

  // Owner / admin alerts
  [WHATSAPP_TEMPLATES.DAILY_BRIEF_READY]:
    '📊 Your daily brief is ready, {{1}}. {{2}} new conversations, R{{3}} outstanding debt, {{4}} staff checked in. View full report: {{5}}',
  [WHATSAPP_TEMPLATES.ESCALATION_ALERT]:
    '⚠️ ESCALATION: {{1}} requires your attention. Client {{2}} — {{3}}. Please respond within {{4}} hours. View: {{5}}',
  [WHATSAPP_TEMPLATES.PAYMENT_ALERT]:
    '💰 Payment received: R{{1}} from {{2}} for invoice #{{3}}. New outstanding balance: R{{4}}. View dashboard: {{5}}',
  [WHATSAPP_TEMPLATES.NEW_CLIENT_ALERT]:
    '🎉 New client! {{1}} signed up for the {{2}} plan. Onboarding starts now. View their profile: {{3}}',
  [WHATSAPP_TEMPLATES.STAFF_CONCERN_ALERT]:
    '⚠️ Staff concern flagged: {{1}} scored {{2}}/10 in today\'s wellness check-in. Consider reaching out. View details: {{3}}',
  [WHATSAPP_TEMPLATES.GOAL_ACHIEVED]:
    '🏆 Goal achieved! {{1}} has been reached. {{2}}. View your progress dashboard: {{3}}',
}
