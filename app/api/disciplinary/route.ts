import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'
import { withRoute, unwrap, notFound } from '@/lib/api/withRoute'
import { isTenantStaff } from '@/lib/people/ownStaff'

const httpsUrl = z.string().url().max(2000).refine((u) => u.startsWith('https://'), 'Must be an https:// link')
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

const createSchema = z.object({
  staffId:       z.string().uuid(),
  recordType:    z.enum(['verbal_warning','written_warning','final_warning','suspension','dismissal','grievance','hearing']),
  // A warning for something that hasn't happened yet is a typo, and a
  // post-dated record undermines the file's credibility at the CCMA.
  incidentDate:  isoDate.refine((d) => d <= new Date(Date.now() + 2 * 3600_000).toISOString().slice(0, 10), 'Incident date cannot be in the future'),
  description:   z.string().trim().min(1).max(5000),
  outcome:       z.string().max(2000).optional(),
  documentsUrl:  z.array(httpsUrl).max(20).optional(),
})

const listQuery = z.object({ staffId: z.string().uuid().optional() })

export const GET = withRoute({ action: 'hr.records', query: listQuery }, async ({ ctx, query }) => {
  let q = supabaseAdmin
    .from('disciplinary_records')
    .select('id, staff_id, record_type, incident_date, description, outcome, documents_url, issued_by, acknowledged_at, created_at, staff(full_name, job_title)')
    .eq('tenant_id', ctx.tenantId)
    .is('deleted_at', null)
    .order('incident_date', { ascending: false })
    .limit(500)
  if (query.staffId) q = q.eq('staff_id', query.staffId)
  return unwrap(await q) ?? []
})

export const POST = withRoute({
  action: 'hr.records',
  body: createSchema,
  status: 201,
  resourceType: 'disciplinary_record',
}, async ({ ctx, body, audit }) => {
  if (!(await isTenantStaff(ctx.tenantId, body.staffId))) throw notFound('Staff member not found')

  const data = unwrap(await supabaseAdmin
    .from('disciplinary_records')
    .insert({
      tenant_id:     ctx.tenantId,
      staff_id:      body.staffId,
      record_type:   body.recordType,
      incident_date: body.incidentDate,
      description:   body.description,
      outcome:       body.outcome ?? null,
      documents_url: body.documentsUrl ?? null,
      issued_by:     ctx.userId,
    })
    .select('id, staff_id, record_type, incident_date, description, outcome, documents_url, issued_by, acknowledged_at, created_at')
    .single(), { required: true })

  await audit({
    action: 'disciplinary.record.created',
    resourceType: 'disciplinary_record',
    resourceId: data.id,
    metadata: { staffId: body.staffId, recordType: body.recordType },
  })
  return data
})
