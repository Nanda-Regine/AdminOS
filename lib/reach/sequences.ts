import { supabaseAdmin } from '@/lib/supabase/admin'
import { phoneDigits, toE164 } from '@/lib/contacts/phone'
import { phoneMayBeMarketed } from '@/lib/reach/audience'

export type EnrolResult =
  | { ok: true; id: string }
  | { ok: false; reason: 'not_found' | 'inactive' | 'no_steps' | 'bad_phone' | 'no_consent' | 'already_enrolled' }

export const ENROL_MESSAGES: Record<Exclude<EnrolResult, { ok: true }>['reason'], string> = {
  not_found:        'Sequence not found',
  inactive:         'Turn this sequence on before enrolling anyone.',
  no_steps:         'This sequence has no steps.',
  bad_phone:        "That isn't a valid phone number.",
  no_consent:       "This contact can't receive marketing: no recorded consent and not a customer, or they opted out (POPIA s69).",
  already_enrolled: 'This contact is already in this sequence.',
}

/**
 * Put one person into one sequence. Every path — the manual Enrol button and
 * the new_contact / new_client triggers — goes through here, so the POPIA s69
 * check and the duplicate guard can't be skipped. Phones are stored E.164 so
 * the duplicate check and STOP-cancellation (recordOptOut) match.
 */
export async function enrolInSequence(tenantId: string, sequenceId: string, phone: string): Promise<EnrolResult> {
  const { data: seq } = await supabaseAdmin
    .from('whatsapp_sequences')
    .select('id, steps, is_active')
    .eq('id', sequenceId).eq('tenant_id', tenantId).is('deleted_at', null)
    .maybeSingle()
  if (!seq) return { ok: false, reason: 'not_found' }
  if (!seq.is_active) return { ok: false, reason: 'inactive' }
  const steps = (seq.steps ?? []) as Array<{ delay_hours?: number }>
  if (!steps.length) return { ok: false, reason: 'no_steps' }

  if (!phoneDigits(phone)) return { ok: false, reason: 'bad_phone' }
  const e164 = toE164(phone)
  if (!(await phoneMayBeMarketed(tenantId, e164))) return { ok: false, reason: 'no_consent' }

  const { data: existing } = await supabaseAdmin
    .from('sequence_enrollments')
    .select('id')
    .eq('tenant_id', tenantId).eq('sequence_id', sequenceId)
    .eq('contact_identifier', e164).eq('status', 'active')
    .limit(1).maybeSingle()
  if (existing) return { ok: false, reason: 'already_enrolled' }

  const nextStepAt = new Date(Date.now() + (steps[0].delay_hours ?? 0) * 3_600_000).toISOString()
  const { data, error } = await supabaseAdmin
    .from('sequence_enrollments')
    .insert({ tenant_id: tenantId, sequence_id: sequenceId, contact_identifier: e164, current_step: 0, next_step_at: nextStepAt, status: 'active' })
    .select('id').single()
  if (error) throw error
  return { ok: true, id: data.id }
}

/**
 * Trigger hook: a contact was created (new_contact) or became a client
 * (new_client). Enrols them into every active sequence with that trigger.
 * Never throws — a sequence must not break contact creation.
 */
export async function runSequenceTrigger(
  tenantId: string,
  trigger: 'new_contact' | 'new_client',
  phone: string | null | undefined,
): Promise<number> {
  if (!phone || !phoneDigits(phone)) return 0
  try {
    const { data: seqs } = await supabaseAdmin
      .from('whatsapp_sequences')
      .select('id')
      .eq('tenant_id', tenantId).eq('trigger_type', trigger).eq('is_active', true).is('deleted_at', null)
      .limit(20)
    let n = 0
    for (const s of seqs ?? []) {
      const r = await enrolInSequence(tenantId, s.id, phone)
      if (r.ok) n++
    }
    return n
  } catch (e) {
    console.error('[sequences] trigger failed', trigger, e)
    return 0
  }
}
