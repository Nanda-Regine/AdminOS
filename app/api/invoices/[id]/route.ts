import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'
import { fireBusinessEvent } from '@/lib/academy/knowledgeGraph'
import { checkPermission } from '@/lib/auth/permissions'
import { notifyTenant } from '@/lib/notifications/notify'
import { sendWhatsApp } from '@/lib/whatsapp/send'
import { getTenantAutonomy } from '@/lib/autonomy/config'
import { resolveTier } from '@/lib/autonomy/tiers'

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
    .select('*, contact:contacts(name:full_name, email, phone)')
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

  // Snapshot the paid status before applying any update — guards the
  // payment-receipt thank-you (and the owner alert / formalization bump)
  // from re-firing on a later PATCH that doesn't actually change payment
  // state (e.g. editing notes on an invoice that was already paid).
  const { data: before } = await supabaseAdmin
    .from('invoices')
    .select('status, amount, total')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle()
  const wasAlreadyPaid = before?.status === 'paid'

  const updates: Record<string, unknown> = {}
  if (body.dueDate  !== undefined) updates.due_date  = body.dueDate
  if (body.notes    !== undefined) updates.notes     = body.notes
  if (body.status   !== undefined) {
    updates.status = body.status
    if (body.status === 'sent') updates.sent_at = new Date().toISOString()
    if (body.status === 'paid') updates.paid_at = new Date().toISOString()
  }

  if (body.amountPaid !== undefined && before) {
    // `total` is what app/api/invoices/route.ts's POST writes alongside the
    // canonical `amount` (always kept equal at creation) — `amount_due` is a
    // real, separately-read column (healthScore.ts, boardPack.ts, invoice
    // documents), so it must stay in sync whenever a payment is recorded.
    const invoiceTotal = Number(before.total ?? before.amount)
    const remaining = invoiceTotal - body.amountPaid
    updates.amount_paid = body.amountPaid
    updates.amount_due  = Math.max(0, remaining)
    if (remaining <= 0)      updates.status = 'paid'
    else if (body.amountPaid > 0) updates.status = 'partial'
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
  const justPaid = !wasAlreadyPaid && data.status === 'paid'
  if (justPaid) {
    fireBusinessEvent('invoice.paid', tenantId, user.id)
    // Celebrate the win — the owner gets pushed the moment money lands.
    await notifyTenant(tenantId, {
      type: 'payment.received',
      title: 'Payment received 🎉',
      body: `${data.contact_name ?? 'A customer'} paid ${data.amount ? 'R' + Number(data.amount).toLocaleString('en-ZA') : 'their invoice'}.`,
      actionUrl: '/dashboard/money',
      dedupeKey: `paid-${id}`,
      whatsapp: true,
    })
    // Update formalization progress
    await supabaseAdmin
      .from('formalization_progress')
      .update({ first_invoice_sent: true })
      .eq('tenant_id', tenantId)
      .eq('first_invoice_sent', false)

    // Autonomy: money/payment_receipt — thank the customer automatically.
    // Default tier is 'A' (send). 'B'/'C' hold — the owner alert above
    // already tells them the payment landed, so no extra draft is needed.
    if (data.contact_phone) {
      const tier = resolveTier(await getTenantAutonomy(tenantId), 'money', 'payment_receipt')
      if (tier === 'A') {
        const amountStr = `R${Number(data.amount_paid ?? data.amount).toLocaleString('en-ZA')}`
        const ref = data.reference ?? String(data.id).slice(0, 8)
        const thankYou = `Hi ${data.contact_name ?? 'there'}, thank you — we've received your payment of ${amountStr} for invoice ${ref}. Much appreciated!`
        try {
          await sendWhatsApp({ to: data.contact_phone, message: thankYou })
        } catch (err) {
          console.error('[invoices] payment receipt send failed (non-fatal)', err)
        }
      }
    }
  }

  return NextResponse.json(data)
}
