import { supabaseAdmin } from '@/lib/supabase/admin'
import { withRoute, unwrap } from '@/lib/api/withRoute'

// GET /api/staff/directory — the colleague list every member may see (staff
// app "Team" screen): name, job title, department. Deliberately NOT phone,
// email, salary, ID or bank details — GET /api/staff (HR only) has those.
// Before this, the staff app read the staff table directly, which RLS either
// blocked entirely or (pre role-aware RLS) exposed every column.
export const GET = withRoute({ action: 'staff.directory' }, async ({ ctx }) => {
  return unwrap(await supabaseAdmin
    .from('staff')
    .select('id, full_name, job_title, department')
    .eq('tenant_id', ctx.tenantId)
    .eq('active', true)
    .is('deleted_at', null)
    .order('full_name')
    .limit(1000)) ?? []
})
