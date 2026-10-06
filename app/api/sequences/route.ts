import { supabaseAdmin } from '@/lib/supabase/admin'
import { withRoute, unwrap } from '@/lib/api/withRoute'
import { createSequenceSchema, normaliseSteps } from '@/lib/reach/sequenceSchema'

export const runtime = 'nodejs'

export const GET = withRoute({ action: 'broadcasts.read' }, async ({ ctx }) => {
  const sequences = unwrap(await supabaseAdmin
    .from('whatsapp_sequences')
    .select('id, name, trigger_type, steps, is_active, created_at, updated_at')
    .eq('tenant_id', ctx.tenantId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(200)) ?? []

  // Active enrolments per sequence — counted in the database, not by pulling
  // every enrolment row (the old way stopped at 1000 and wasn't tenant-scoped).
  const counts = await Promise.all(sequences.map(async (s) => {
    const { count } = await supabaseAdmin
      .from('sequence_enrollments')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', ctx.tenantId).eq('sequence_id', s.id).eq('status', 'active')
    return count ?? 0
  }))
  return sequences.map((s, i) => ({ ...s, active_enrollments: counts[i] }))
})

export const POST = withRoute({
  action: 'broadcasts.send',
  body: createSequenceSchema,
  audit: 'sequence.created',
  resourceType: 'whatsapp_sequence',
  status: 201,
}, async ({ ctx, body }) => {
  return unwrap(await supabaseAdmin
    .from('whatsapp_sequences')
    .insert({
      tenant_id:    ctx.tenantId,
      name:         body.name,
      trigger_type: body.trigger_type,
      steps:        normaliseSteps(body.steps),
      is_active:    body.is_active,
    })
    .select('id, name, trigger_type, is_active')
    .single())
})
