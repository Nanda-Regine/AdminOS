import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { withRoute, unwrap, notFound } from '@/lib/api/withRoute'

const patchSchema = z.object({
  rootCause:        z.string().max(2000).optional(),
  correctiveAction: z.string().max(2000).optional(),
  iodReported:      z.boolean().optional(),
  iodReference:     z.string().max(100).optional(),
}).refine((b) => Object.keys(b).length > 0, 'Nothing to update')

const COLUMNS = 'id, staff_id, incident_date, incident_type, description, location, witnesses, immediate_action, root_cause, corrective_action, iod_reported, iod_reference, created_by, created_at'

// PATCH /api/safety/[id] — close-out of an incident (HR). Root cause and the
// corrective action are usually only known after the report, and the IOD claim
// is often filed days later. Marking the IOD reported also completes the COIDA
// W.Cl.2 reminder raised when the incident was logged, so the register and the
// compliance calendar agree.
export const PATCH = withRoute({
  action: 'hr.records',
  body: patchSchema,
  audit: 'safety.incident_updated',
  resourceType: 'safety_incident',
  rateLimit: 'api',
}, async ({ ctx, params, body }) => {
  if (!z.string().uuid().safeParse(params.id).success) throw notFound('Incident not found')

  const updates: Record<string, unknown> = {}
  if (body.rootCause !== undefined)        updates.root_cause = body.rootCause
  if (body.correctiveAction !== undefined) updates.corrective_action = body.correctiveAction
  if (body.iodReported !== undefined)      updates.iod_reported = body.iodReported
  if (body.iodReference !== undefined)     updates.iod_reference = body.iodReference

  const row = unwrap(await supabaseAdmin
    .from('safety_incidents')
    .update(updates)
    .eq('id', params.id)
    .eq('tenant_id', ctx.tenantId)
    .is('deleted_at', null)
    .select(COLUMNS)
    .maybeSingle())
  if (!row) throw notFound('Incident not found')

  if (body.iodReported === true) {
    const day = String(row.incident_date).slice(0, 10)
    unwrap(await supabaseAdmin
      .from('compliance_items')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('tenant_id', ctx.tenantId)
      .eq('item_type', 'coida_report')
      .like('title', `COIDA W.Cl.2 — injury on duty ${day}%`)
      .neq('status', 'completed'))
  }
  return row
})
