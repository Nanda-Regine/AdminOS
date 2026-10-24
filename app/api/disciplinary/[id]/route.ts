import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { withRoute, unwrap, notFound, badRequest } from '@/lib/api/withRoute'
import { ownStaffId } from '@/lib/people/ownStaff'
import { can } from '@/lib/auth/roleMatrix'

// PATCH /api/disciplinary/[id] — acknowledge a record.
//   - The employee it concerns acknowledges their own record.
//   - HR (hr.records) may record the acknowledgement on their behalf (e.g. a
//     signed paper copy); the audit row carries the acting role.
// Acknowledging means "received", not "agreed". It is written once and never
// overwritten, so the first timestamp is the one that stands.
export const PATCH = withRoute({
  action: 'ir.own',
  audit: 'disciplinary.record.acknowledged',
  resourceType: 'disciplinary_record',
  rateLimit: 'api',
}, async ({ ctx, params }) => {
  if (!z.string().uuid().safeParse(params.id).success) throw notFound('Record not found')

  const record = unwrap(await supabaseAdmin
    .from('disciplinary_records')
    .select('id, staff_id, acknowledged_at')
    .eq('id', params.id)
    .eq('tenant_id', ctx.tenantId)
    .is('deleted_at', null)
    .maybeSingle())
  if (!record) throw notFound('Record not found')

  const mine = await ownStaffId(ctx.tenantId, ctx.userId)
  if (record.staff_id !== mine && !can(ctx, 'hr.records')) throw notFound('Record not found')
  if (record.acknowledged_at) throw badRequest('This record has already been acknowledged.')

  return unwrap(await supabaseAdmin
    .from('disciplinary_records')
    .update({ acknowledged_at: new Date().toISOString() })
    .eq('id', record.id)
    .eq('tenant_id', ctx.tenantId)
    .is('acknowledged_at', null)
    .select('id, acknowledged_at')
    .single(), { required: true })
})
