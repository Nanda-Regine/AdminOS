import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requirePermission } from '@/lib/auth/permissions'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.user_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  try { await requirePermission('manage_staff') } catch {
    return new NextResponse('Forbidden', { status: 403 })
  }

  const { id } = await params

  // Fetch the leave request to get days and staff_id
  const { data: req, error: fetchErr } = await supabaseAdmin
    .from('leave_requests')
    .select('id, staff_id, days, status')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single()

  if (fetchErr || !req) return NextResponse.json({ error: 'Leave request not found' }, { status: 404 })
  if (req.status === 'approved') return NextResponse.json({ message: 'Already approved' })

  // Approve the request
  const { error: updateErr } = await supabaseAdmin
    .from('leave_requests')
    .update({ status: 'approved', approved_by: user.id, approved_at: new Date().toISOString() })
    .eq('id', id)
    .eq('tenant_id', tenantId)

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 400 })

  // Deduct leave balance from staff record
  if (req.days && req.staff_id) {
    const { data: staff } = await supabaseAdmin
      .from('staff')
      .select('leave_balance, leave_taken')
      .eq('id', req.staff_id)
      .single()

    if (staff) {
      await supabaseAdmin
        .from('staff')
        .update({
          leave_taken: (staff.leave_taken || 0) + req.days,
        })
        .eq('id', req.staff_id)
    }
  }

  const origin = new URL(_req.url).origin
  return NextResponse.redirect(new URL('/dashboard/team', origin))
}
