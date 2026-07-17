import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'
import { fireBusinessEvent } from '@/lib/academy/knowledgeGraph'
import { checkPermission } from '@/lib/auth/permissions'

const updateSchema = z.object({
  status:   z.enum(['draft','sent','unpaid','partial','paid','overdue','cancelled']).optional(),
  dueDate:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes:    z.string().max(2000).optional(),
  amountPaid: z.number().nonnegative().optional(),
})

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.app_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  if (!(await checkPermission('manage_invoices'))) return new NextResponse('Forbidden', { status: 403 })

  const { id } = await params

  const { data, error } = await supabaseAdmin
    .from('invoices')
    .select('*, contact:contacts(name, email, phone, address)')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single()

  if (error) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.app_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  if (!(await checkPermission('manage_invoices'))) return new NextResponse('Forbidden', { status: 403 })

  const { id } = await params

  let body: z.infer<typeof updateSchema>
  try { body = updateSchema.parse(await request.json()) } catch (e) {
    return NextResponse.json({ error: 'Invalid request', detail: e }, { status: 400 })
  }

  const updates: Record<string, unknown> = {}
  if (body.dueDate  !== undefined) updates.due_date  = body.dueDate
  if (body.notes    !== undefined) updates.notes     = body.notes
  if (body.status   !== undefined) {
    updates.status = body.status
    if (body.status === 'sent') updates.sent_at = new Date().toISOString()
    if (body.status === 'paid') updates.paid_at = new Date().toISOString()
  }

  if (body.amountPaid !== undefined) {
    const { data: inv } = await supabaseAdmin
      .from('invoices')
      .select('total, amount_due')
      .eq('id', id)
      .single()

    if (inv) {
      const remaining = inv.total - body.amountPaid
      updates.amount_paid = body.amountPaid
      updates.amount_due  = Math.max(0, remaining)
      if (remaining <= 0)      updates.status = 'paid'
      else if (body.amountPaid > 0) updates.status = 'partial'
    }
  }

  const { data, error } = await supabaseAdmin
    .from('invoices')
    .update(updates)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Fire events for status changes
  if (body.status === 'sent') fireBusinessEvent('invoice.sent', tenantId, user.id)
  if (body.status === 'paid' || (body.amountPaid !== undefined && data.status === 'paid')) {
    fireBusinessEvent('invoice.paid', tenantId, user.id)
    // Update formalization progress
    await supabaseAdmin
      .from('formalization_progress')
      .update({ first_invoice_sent: true })
      .eq('tenant_id', tenantId)
      .eq('first_invoice_sent', false)
  }

  return NextResponse.json(data)
}
