import { supabaseAdmin } from '@/lib/supabase/admin'
import { withRoute, unwrap, notFound, badRequest } from '@/lib/api/withRoute'
import { softDelete } from '@/lib/db/softDelete'
import { patchSequenceSchema, normaliseSteps } from '@/lib/reach/sequenceSchema'

export const runtime = 'nodejs'

export const PATCH = withRoute({
  action: 'broadcasts.send',
  body: patchSequenceSchema,
  audit: 'sequence.updated',
  resourceType: 'whatsapp_sequence',
}, async ({ ctx, body, params }) => {
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.name !== undefined)         update.name = body.name
  if (body.trigger_type !== undefined) update.trigger_type = body.trigger_type
  if (body.is_active !== undefined)    update.is_active = body.is_active
  if (body.steps !== undefined)        update.steps = normaliseSteps(body.steps)
  if (Object.keys(update).length === 1) throw badRequest('Nothing to change.')

  return unwrap(await supabaseAdmin
    .from('whatsapp_sequences')
    .update(update)
    .eq('id', params.id)
    .eq('tenant_id', ctx.tenantId)
    .is('deleted_at', null)
    .select('id, name, trigger_type, is_active')
    .maybeSingle(), { required: true, what: 'Sequence not found' })
})

// Soft delete (Rule #3); anyone still mid-sequence stops receiving it.
export const DELETE = withRoute({
  action: 'broadcasts.send',
  audit: 'sequence.deleted',
  resourceType: 'whatsapp_sequence',
}, async ({ ctx, params }) => {
  if (!(await softDelete(supabaseAdmin, 'whatsapp_sequences', { id: params.id, tenantId: ctx.tenantId }))) throw notFound('Sequence not found')
  await supabaseAdmin.from('sequence_enrollments').update({ status: 'cancelled' })
    .eq('tenant_id', ctx.tenantId).eq('sequence_id', params.id).eq('status', 'active')
  return { id: params.id, deleted: true }
})
