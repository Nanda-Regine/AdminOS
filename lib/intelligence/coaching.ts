import { supabaseAdmin } from '@/lib/supabase/admin'

export interface CoachingCard {
  id:             string
  triggerAction:  string
  title:          string
  body:           string
  severity:       'info' | 'warning' | 'critical'
  checklist:      { item: string; required: boolean }[]
  academyLesson?: string
  frameworkSlug?: string
}

// Fetch the coaching card for a given pre-action trigger
export async function getCoachingCard(triggerAction: string): Promise<CoachingCard | null> {
  const { data, error } = await supabaseAdmin
    .from('coaching_cards')
    .select('id, trigger_action, title, body, severity, checklist, academy_lesson, framework_slug')
    .eq('trigger_action', triggerAction)
    .maybeSingle()

  if (error || !data) return null

  return {
    id:             data.id,
    triggerAction:  data.trigger_action,
    title:          data.title,
    body:           data.body,
    severity:       data.severity as CoachingCard['severity'],
    checklist:      (data.checklist as { item: string; required: boolean }[]) ?? [],
    academyLesson:  data.academy_lesson ?? undefined,
    frameworkSlug:  data.framework_slug ?? undefined,
  }
}

// Map of UI actions to coaching trigger names
export const COACHING_TRIGGERS: Record<string, string> = {
  // Employment & HR
  'dismissal.initiate':           'dismissal.initiate',
  'probation.extend':             'probation.extend',
  'disciplinary.final_warning':   'disciplinary.final_warning',

  // Finance & Legal
  'final_demand.send':            'final_demand.send',
  'contract.sign_without_expiry': 'contract.sign_without_expiry',
  'vat.cross_threshold':          'vat.cross_threshold',

  // Operations
  'invoice.send_no_payment_terms': 'invoice.send_no_payment_terms',
  'staff.add_no_contract':         'staff.add_no_contract',
}
