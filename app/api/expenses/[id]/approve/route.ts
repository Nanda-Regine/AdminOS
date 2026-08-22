import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requirePermission } from '@/lib/auth/permissions'
import { writeAuditLog, getClientIp } from '@/lib/security/audit'

// The dashboard page posts to this route with a native <form method="POST">
// (via ConfirmSubmit — see app/dashboard/expenses/page.tsx), the same pattern
// used by app/api/leave/[id]/approve. It was exported as PATCH, which a
// browser form can never send (forms only do GET/POST), so every click 405'd
// before any of this code ran. It also read `await request.json()`, but a
// native form submits `application/x-www-form-urlencoded` body, not JSON —
// that would have thrown on the first request that got past the method
// check. Fixed to export POST, read the `action` field via request.formData(),
// and redirect back to the dashboard afterwards (matching the leave-approval
// route) instead of returning a JSON body to a full-page form navigation.
export async function POST(
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
  const formData = await request.formData()
  const action = formData.get('action') as 'approve' | 'reject' | null

  if (!action || !['approve', 'reject'].includes(action)) {
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

  const { error } = await supabaseAdmin
    .from('expenses')
    .update({
      status:      action === 'approve' ? 'approved' : 'rejected',
      approved_by: user.id,
      approved_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('tenant_id', tenantId)   // defence-in-depth: also constrain the mutation, not just the prior fetch

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await writeAuditLog({
    actor:        user.id,
    action:       `expense.${action}d`,
    resourceType: 'expense',
    resourceId:   id,
    ipAddress:    getClientIp(request),
    metadata:     { tenantId },
  })

  // Native form POST — redirect back to the dashboard page instead of
  // returning a JSON body (matching app/api/leave/[id]/approve).
  const origin = new URL(request.url).origin
  return NextResponse.redirect(new URL('/dashboard/expenses', origin))
}
