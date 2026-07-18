import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requirePermission } from '@/lib/auth/permissions'
import { writeAuditLog, getClientIp } from '@/lib/security/audit'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.app_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  try {
    await requirePermission('approve_leave')  // reuse — covers expense approval too
  } catch {
    return new NextResponse('Forbidden', { status: 403 })
  }

  const { id } = await params
  const { action } = await request.json() as { action: 'approve' | 'reject' }

  if (!['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'action must be approve or reject' }, { status: 400 })
  }

  const { data: expense } = await supabaseAdmin
    .from('expenses')
    .select('id, status')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single()

  if (!expense) return new NextResponse('Not found', { status: 404 })
  if (expense.status !== 'pending') {
    return NextResponse.json({ error: 'Expense is no longer pending' }, { status: 409 })
  }

  const { data, error } = await supabaseAdmin
    .from('expenses')
    .update({
      status:      action === 'approve' ? 'approved' : 'rejected',
      approved_by: user.id,
      approved_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('tenant_id', tenantId)   // defence-in-depth: also constrain the mutation, not just the prior fetch
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await writeAuditLog({
    actor:        user.id,
    action:       `expense.${action}d`,
    resourceType: 'expense',
    resourceId:   id,
    ipAddress:    getClientIp(request),
    metadata:     { tenantId },
  })

  return NextResponse.json(data)
}
