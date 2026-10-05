import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { renderPayslip, PAYSLIP_SELECT, HTML_HEADERS } from '@/lib/payroll/renderPayslip'
import { withRoute, notFound, unwrap, RouteError } from '@/lib/api/withRoute'
import { can } from '@/lib/auth/roleMatrix'

// GET /api/payroll/payslip/[id]
// Printable HTML payslip for a signed-in user. Employees see only their own;
// anyone with payroll.read (owner/admin by default) sees all. Employees
// without a login open theirs via the token link (app/api/payslips/view).
// Add ?download=true to get Content-Disposition: attachment.
export const GET = withRoute({ action: 'payslip.read_own' }, async ({ request, ctx, params }) => {
  const { tenantId, userId } = ctx

  const payslip = unwrap(await supabaseAdmin
    .from('payslips')
    .select(PAYSLIP_SELECT)
    .eq('id', params.id)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .maybeSingle())
  if (!payslip) throw notFound()

  // Employees can only view their own. The caller's staff record is resolved
  // from staff.user_id (which they cannot forge), never from user_metadata.
  if (!can(ctx, 'payroll.read')) {
    const { data: ownStaff } = await supabaseAdmin
      .from('staff')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .maybeSingle()
    if (!ownStaff || ownStaff.id !== (payslip as { staff_id: string }).staff_id) {
      throw new RouteError(403, 'You can only view your own payslip.', 'forbidden')
    }
  }

  const html = await renderPayslip(payslip as unknown as Record<string, unknown>, { masked: false })
  const headers: Record<string, string> = { ...HTML_HEADERS }
  if (new URL(request.url).searchParams.get('download') === 'true') {
    headers['Content-Disposition'] = `attachment; filename="payslip-${params.id.slice(0, 8)}.html"`
  }
  return new NextResponse(html, { headers })
})
