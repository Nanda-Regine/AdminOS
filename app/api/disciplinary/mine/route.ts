import { supabaseAdmin } from '@/lib/supabase/admin'
import { withRoute, unwrap } from '@/lib/api/withRoute'
import { ownStaffId } from '@/lib/people/ownStaff'

// GET /api/disciplinary/mine — the caller's own IR records, so an employee can
// read and acknowledge what is on their file. A login not linked to a staff
// row gets an empty list, never someone else's records.
export const GET = withRoute({ action: 'ir.own' }, async ({ ctx }) => {
  const staffId = await ownStaffId(ctx.tenantId, ctx.userId)
  if (!staffId) return []
  return unwrap(await supabaseAdmin
    .from('disciplinary_records')
    .select('id, record_type, incident_date, description, outcome, acknowledged_at, created_at')
    .eq('tenant_id', ctx.tenantId)
    .eq('staff_id', staffId)
    .is('deleted_at', null)
    .order('incident_date', { ascending: false })
    .limit(200)) ?? []
})
