import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'
import { withRoute, unwrap, notFound } from '@/lib/api/withRoute'
import { isTenantStaff } from '@/lib/people/ownStaff'
import { can } from '@/lib/auth/roleMatrix'

const createSchema = z.object({
  staffId:          z.string().uuid().optional(),
  incidentDate:     z.string().datetime({ offset: true })
    .refine((d) => new Date(d).getTime() <= Date.now() + 3600_000, 'Incident date cannot be in the future'),
  incidentType:     z.enum(['near_miss','minor_injury','major_injury','fatality','property_damage','environmental']),
  description:      z.string().trim().min(10).max(5000),
  location:         z.string().max(300).optional(),
  witnesses:        z.array(z.string().max(200)).max(50).default([]),
  immediateAction:  z.string().max(2000).optional(),
  rootCause:        z.string().max(2000).optional(),
  correctiveAction: z.string().max(2000).optional(),
  iodReported:      z.boolean().default(false),
  iodReference:     z.string().max(100).optional(),
})

const listQuery = z.object({
  type: z.enum(['near_miss','minor_injury','major_injury','fatality','property_damage','environmental']).optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to:   z.string().datetime({ offset: true }).optional(),
})

const COLUMNS = 'id, staff_id, incident_date, incident_type, description, location, witnesses, immediate_action, root_cause, corrective_action, iod_reported, iod_reference, created_by, created_at'

// GET — the incident register is HR's; a reporter sees only what they filed.
export const GET = withRoute({ action: 'safety.report', query: listQuery }, async ({ ctx, query }) => {
  let q = supabaseAdmin
    .from('safety_incidents')
    .select(`${COLUMNS}, staff:staff(full_name, role)`)
    .eq('tenant_id', ctx.tenantId)
    .is('deleted_at', null)
    .order('incident_date', { ascending: false })
    .limit(500)
  if (!can(ctx, 'hr.records')) q = q.eq('created_by', ctx.userId)
  if (query.type) q = q.eq('incident_type', query.type)
  if (query.from) q = q.gte('incident_date', query.from)
  if (query.to)   q = q.lte('incident_date', query.to)
  return unwrap(await q) ?? []
})

/** YYYY-MM-DD, `days` after an instant, in SAST. */
function sastDatePlus(iso: string, days: number): string {
  return new Date(new Date(iso).getTime() + 2 * 3600_000 + days * 86400_000).toISOString().slice(0, 10)
}

// POST — anyone may report an incident (OHSA expects every worker to).
export const POST = withRoute({
  action: 'safety.report',
  body: createSchema,
  status: 201,
  audit: 'safety.incident_reported',
  resourceType: 'safety_incident',
  rateLimit: 'api',
}, async ({ ctx, body }) => {
  // GET embeds staff(full_name, role) via the service role — a foreign id
  // here would leak another tenant's staff details.
  if (body.staffId && !(await isTenantStaff(ctx.tenantId, body.staffId))) throw notFound('Staff member not found')

  const data = unwrap(await supabaseAdmin
    .from('safety_incidents')
    .insert({
      tenant_id:         ctx.tenantId,
      staff_id:          body.staffId          ?? null,
      incident_date:     body.incidentDate,
      incident_type:     body.incidentType,
      description:       body.description,
      location:          body.location         ?? null,
      witnesses:         body.witnesses,
      immediate_action:  body.immediateAction  ?? null,
      root_cause:        body.rootCause        ?? null,
      corrective_action: body.correctiveAction ?? null,
      iod_reported:      body.iodReported,
      iod_reference:     body.iodReference     ?? null,
      created_by:        ctx.userId,
    })
    .select(COLUMNS)
    .single(), { required: true })

  // Statutory follow-ups, due from the INCIDENT date (it was counted from the
  // day it was logged, so a back-dated entry showed a deadline that had in
  // fact already passed):
  //  - COIDA s38/39: any injury on duty → W.Cl.2 to the Compensation Fund
  //    within 7 days. Was only raised for major injuries and fatalities.
  //  - OHSA s24 / GAR 8: death or major injury → report to the DEL inspector
  //    within 7 days (a fatality: notify immediately). Was never raised.
  const day = body.incidentDate.slice(0, 10)
  const items: Record<string, unknown>[] = []
  const injury = ['minor_injury', 'major_injury', 'fatality'].includes(body.incidentType)
  const serious = ['major_injury', 'fatality'].includes(body.incidentType)
  if (injury && !body.iodReported) {
    items.push({
      tenant_id: ctx.tenantId,
      item_type: 'coida_report',
      title: `COIDA W.Cl.2 — injury on duty ${day}`,
      description: `Report the injury on ${day} to the Compensation Fund (W.Cl.2) within 7 days of the incident.`,
      due_date: sastDatePlus(body.incidentDate, 7),
      penalty_description: 'If the employer fails to report, it may have to pay the full cost of compensation itself.',
    })
  }
  if (serious) {
    items.push({
      tenant_id: ctx.tenantId,
      item_type: 'ohsa_incident_report',
      title: `OHSA s24 — report ${body.incidentType === 'fatality' ? 'FATALITY' : 'major injury'} to the Labour inspector`,
      description: body.incidentType === 'fatality'
        ? `A fatality on ${day} must be reported to the Department of Employment and Labour immediately, followed by the Annexure 1 form within 7 days. Do not disturb the scene until the inspector allows it.`
        : `Report the major injury on ${day} to the Department of Employment and Labour (Annexure 1) within 7 days.`,
      due_date: body.incidentType === 'fatality' ? sastDatePlus(body.incidentDate, 0) : sastDatePlus(body.incidentDate, 7),
      penalty_description: 'Failing to report is an offence under the Occupational Health and Safety Act.',
    })
  }
  if (items.length) {
    const { error } = await supabaseAdmin.from('compliance_items').insert(items)
    // The incident is recorded either way; a missing reminder must still be loud.
    if (error) console.error('[safety] compliance follow-up insert failed', { tenantId: ctx.tenantId, incident: data.id, code: error.code })
  }

  return data
})
