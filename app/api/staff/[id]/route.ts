import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { withRoute, unwrap, notFound } from '@/lib/api/withRoute'

const patchSchema = z.object({ active: z.boolean() })

// PATCH /api/staff/[id] — deactivate (offboard) or reactivate. Never a delete:
// the record, payslips and IR history stay for the statutory retention period.
// Inactive staff drop out of payroll runs, rosters and valuation head-counts.
export const PATCH = withRoute({
  action: 'staff.write',
  body: patchSchema,
  audit: 'staff.status_changed',
  resourceType: 'staff',
  rateLimit: 'api',
}, async ({ ctx, params, body }) => {
  if (!z.string().uuid().safeParse(params.id).success) throw notFound('Staff member not found')

  const row = unwrap(await supabaseAdmin
    .from('staff')
    .update({ active: body.active })
    .eq('id', params.id)
    .eq('tenant_id', ctx.tenantId)
    .is('deleted_at', null)
    .select('id, active')
    .maybeSingle())
  if (!row) throw notFound('Staff member not found')

  // A leaver's unused app invites must not stay redeemable.
  if (!body.active) {
    unwrap(await supabaseAdmin
      .from('staff_invites')
      .update({ revoked_at: new Date().toISOString() })
      .eq('tenant_id', ctx.tenantId)
      .eq('staff_id', row.id)
      .is('used_at', null)
      .is('revoked_at', null))
  }
  return row
})
