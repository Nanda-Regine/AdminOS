import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'
import { fireBusinessEvent } from '@/lib/academy/knowledgeGraph'
import { checkPermission } from '@/lib/auth/permissions'

const lineItemSchema = z.object({
  description:  z.string().min(1).max(500),
  quantity:     z.number().positive().default(1),
  unitPrice:    z.number().nonnegative(),
  vatRate:      z.number().min(0).max(1).default(0.15),
})

const createSchema = z.object({
  contactId:    z.string().uuid().optional(),
  contactName:  z.string().max(200).optional(),   // free-text recipient when no contact is linked
  lineItems:    z.array(lineItemSchema).min(1),
  dueDate:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes:        z.string().max(2000).optional(),
  reference:    z.string().max(100).optional(),
  currency:     z.string().default('ZAR'),
})

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.app_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  if (!(await checkPermission('manage_invoices'))) return new NextResponse('Forbidden', { status: 403 })

  const url       = new URL(request.url)
  const status    = url.searchParams.get('status')
  const contactId = url.searchParams.get('contactId')
  const from      = url.searchParams.get('from')
  const to        = url.searchParams.get('to')
  const overdue   = url.searchParams.get('overdue') === 'true'
  const limit     = Math.min(parseInt(url.searchParams.get('limit') ?? '50'), 200)

  let query = supabaseAdmin
    .from('invoices')
    .select('*, contact:contacts(name:full_name, email, phone)')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (status)    query = query.eq('status', status)
  if (contactId) query = query.eq('contact_id', contactId)
  if (from)      query = query.gte('created_at', from)
  if (to)        query = query.lte('created_at', to)
  if (overdue)   query = query.gt('days_overdue', 0).not('status', 'in', '(paid,cancelled)')

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.app_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  if (!(await checkPermission('manage_invoices'))) return new NextResponse('Forbidden', { status: 403 })

  let body: z.infer<typeof createSchema>
  try { body = createSchema.parse(await request.json()) } catch (e) {
    return NextResponse.json({ error: 'Invalid request', detail: e }, { status: 400 })
  }

  // Calculate totals
  let subtotal = 0
  let vatTotal = 0

  const lineItemsWithTotals = body.lineItems.map(item => {
    const lineSubtotal = item.quantity * item.unitPrice
    const lineVat      = lineSubtotal * item.vatRate
    subtotal += lineSubtotal
    vatTotal += lineVat
    return { ...item, line_subtotal: lineSubtotal, line_vat: lineVat }
  })

  const total = subtotal + vatTotal

  // Generate invoice number (INV-YYYYMMDD-NNNN)
  const today    = new Date().toISOString().split('T')[0].replace(/-/g, '')
  const { count } = await supabaseAdmin
    .from('invoices')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)

  const invoiceNumber = `INV-${today}-${String((count ?? 0) + 1).padStart(4, '0')}`

  // Resolve the recipient name. `contact_name` is NOT NULL and is the column the
  // list, exports and recovery all read — the old insert never set it (every
  // create 400'd) and wrote the value to the vestigial `total` column instead of
  // the canonical `amount`. Look up the linked contact server-side; fall back to
  // a free-text name, then to a safe placeholder.
  let contactName = body.contactName?.trim() || null
  if (body.contactId) {
    const { data: contact } = await supabaseAdmin
      .from('contacts')
      .select('full_name')
      .eq('id', body.contactId)
      .eq('tenant_id', tenantId)
      .single()
    if (contact?.full_name) contactName = contact.full_name
  }
  if (!contactName) contactName = 'Cash sale'

  const { data, error } = await supabaseAdmin
    .from('invoices')
    .insert({
      tenant_id:      tenantId,
      contact_id:     body.contactId  ?? null,
      contact_name:   contactName,
      invoice_number: invoiceNumber,
      line_items:     lineItemsWithTotals,
      subtotal,
      vat_amount:     vatTotal,
      total,
      amount:         total,   // canonical value column the whole app reads
      amount_paid:    0,
      amount_due:     total,
      currency:       body.currency,
      due_date:       body.dueDate   ?? null,
      notes:          body.notes     ?? null,
      reference:      body.reference ?? null,
      status:         'sent',
      created_by:     user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Update formalization progress
  await supabaseAdmin
    .from('formalization_progress')
    .update({ first_invoice_sent: true })
    .eq('tenant_id', tenantId)
    .eq('first_invoice_sent', false)

  fireBusinessEvent('invoice.created', tenantId, user.id)

  return NextResponse.json(data, { status: 201 })
}
