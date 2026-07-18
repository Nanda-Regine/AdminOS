import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

// GET /api/staff/[id]/payslips
// Returns all payslips for a specific staff member. Tenant ownership is enforced.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.app_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  const { id: staffId } = await params

  // Verify the staff member belongs to this tenant
  const { data: staff } = await supabaseAdmin
    .from('staff')
    .select('id')
    .eq('id', staffId)
    .eq('tenant_id', tenantId)
    .single()

  if (!staff) return new NextResponse('Staff not found', { status: 404 })

  // Alias to real columns (gross_salary/net_pay/other_deductions_total);
  // period_start/period_end/status don't exist on payslips.
  const { data, error } = await supabaseAdmin
    .from('payslips')
    .select('id, tenant_id, payroll_run_id, staff_id, gross:gross_salary, deductions:other_deductions_total, net:net_pay, pdf_url, created_at')
    .eq('tenant_id', tenantId)
    .eq('staff_id', staffId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json(data)
}
