import { supabaseAdmin } from '@/lib/supabase/admin'

export interface TenantSnapshot {
  tenantId: string
  plan: string
  businessType?: string
  healthScore?: number
  revenueTotal?: number
  staffCount?: number
  invoiceCount?: number
  debtorDays?: number
  grossMargin?: number
  cashBalance?: number
  sopCount?: number
  npsScore?: number
  businessAgeMonths?: number
}

export interface FrameworkMatch {
  slug: string
  frameworkName: string
  bookTitle: string
  author: string
  coreInsight: string
  urgency: string
  actionLabel?: string
  actionRoute?: string
}

export interface TriggeredLessonResult {
  triggerId: string
  frameworkSlug?: string
  lessonId?: string
  messageTemplate?: string
}

// Maps business event types to framework situation_tags for lookup
const EVENT_TAG_MAP: Record<string, string[]> = {
  'invoice.first_sent':          ['invoicing', 'payment-terms'],
  'invoice.overdue_7d':          ['late-payment', 'cash-flow', 'debtors'],
  'invoice.overdue_30d':         ['late-payment', 'cash-flow', 'debtors', 'crisis'],
  'staff.first_added':           ['hiring', 'employment-contract', 'team'],
  'staff.wellness_low':          ['team', 'wellness', 'culture', 'burnout'],
  'staff.new_hire':              ['hiring', 'onboarding', 'who-method'],
  'expense.first_submitted':     ['expenses', 'cost-management'],
  'contract.no_expiry':          ['contracts', 'legal-risk'],
  'financial.margin_drop':       ['gross-margin', 'pricing', 'profitability'],
  'financial.revenue_1m':        ['vat', 'tax', 'scale'],
  'financial.cash_negative':     ['cash-flow', 'profit-first', 'crisis'],
  'financial.debtor_days_45':    ['debtors', 'cash-conversion', 'working-capital'],
  'financial.vat_threshold':     ['vat', 'tax', 'compliance'],
  'financial.international_tx':  ['forex', 'sarb', 'international'],
  'financial.revenue_plateau':   ['strategy', 'blue-ocean', 'growth'],
  'supplier.first_no_po':        ['procurement', 'purchase-orders'],
  'health.score_below_60':       ['health-score', 'business-foundations'],
  'broadcast.first_sent':        ['marketing', 'popia', 'whatsapp'],
  'leave.declined_twice':        ['hr', 'leave-management', 'conflict'],
  'client.key_dependency':       ['sales', 'client-risk', 'concentration'],
  'business.year_one':           ['milestone', 'growth', 'momentum'],
  'business.year_two':           ['milestone', 'scale', 'mastery'],
  'business.year_three':         ['milestone', 'legacy', 'exit'],
  'owner.task_overload':         ['delegation', 'systems', 'e-myth'],
  'ops.no_sops':                 ['systems', 'documentation', 'sops'],
  'disciplinary.first_record':   ['disciplinary', 'lra', 'hr'],
  'customer.nps_below_6':        ['nps', 'customer-recovery', 'retention'],
  'payroll.first_run':           ['payroll', 'compliance', 'uif'],
  'compliance.bbbbee_uploaded':  ['bbbbee', 'transformation', 'compliance'],
  'exit.score_calculated':       ['exit', 'valuation', 'built-to-sell'],
}

export async function getRelevantFrameworks(
  eventType: string,
  _tenantData?: TenantSnapshot
): Promise<FrameworkMatch[]> {
  const tags = EVENT_TAG_MAP[eventType]
  if (!tags || tags.length === 0) return []

  const { data, error } = await supabaseAdmin
    .from('framework_library')
    .select('slug, framework_name, book_title, author, core_insight, urgency, action_label, action_route')
    .overlaps('situation_tags', tags)
    // crisis first, then warning, then opportunity
    .order('urgency', { ascending: true })
    .limit(3)

  if (error || !data) return []

  return data.map((f) => ({
    slug:          f.slug,
    frameworkName: f.framework_name,
    bookTitle:     f.book_title,
    author:        f.author,
    coreInsight:   f.core_insight,
    urgency:       f.urgency,
    actionLabel:   f.action_label  ?? undefined,
    actionRoute:   f.action_route  ?? undefined,
  }))
}

export async function getTriggeredLesson(
  eventType: string,
  tenantId: string,
  userId: string
): Promise<TriggeredLessonResult | null> {
  const { data: trigger } = await supabaseAdmin
    .from('contextual_triggers')
    .select('id, framework_slug, lesson_id, message_template, cooldown_hours')
    .eq('event_type', eventType)
    .limit(1)
    .maybeSingle()

  if (!trigger) return null

  // Respect cooldown — skip if this trigger has already fired for this user within the window
  const cooldownCutoff = new Date(
    Date.now() - trigger.cooldown_hours * 60 * 60 * 1000
  ).toISOString()

  const { data: recent } = await supabaseAdmin
    .from('triggered_lessons')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .eq('trigger_id', trigger.id)
    .gte('triggered_at', cooldownCutoff)
    .limit(1)
    .maybeSingle()

  if (recent) return null

  // If the trigger points to a specific lesson and the user already completed it, skip
  if (trigger.lesson_id) {
    const { data: completed } = await supabaseAdmin
      .from('academy_progress')
      .select('id')
      .eq('user_id', userId)
      .eq('lesson_id', trigger.lesson_id)
      .not('completed_at', 'is', null)
      .limit(1)
      .maybeSingle()

    if (completed) return null
  }

  // Record the firing so cooldown is respected next time
  await supabaseAdmin.from('triggered_lessons').insert({
    tenant_id:    tenantId,
    user_id:      userId,
    trigger_id:   trigger.id,
    triggered_at: new Date().toISOString(),
  })

  return {
    triggerId:       trigger.id,
    frameworkSlug:   trigger.framework_slug ?? undefined,
    lessonId:        trigger.lesson_id      ?? undefined,
    messageTemplate: trigger.message_template ?? undefined,
  }
}

// Fire-and-forget helper — call after any business event without awaiting
export function fireBusinessEvent(
  eventType: string,
  tenantId: string,
  userId: string
): void {
  getTriggeredLesson(eventType, tenantId, userId).catch(() => null)
}
