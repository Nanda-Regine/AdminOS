import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'
import { fireBusinessEvent } from '@/lib/academy/knowledgeGraph'
import { checkPermission } from '@/lib/auth/permissions'
import { handleInvoicePaid } from '@/lib/invoices/onPaid'
import { isValidKey, DEFAULT_INCOME_KEY } from '@/lib/finance/chartOfAccounts'

const lineItemSchema = z.object({
  // When set, description/unitPrice are resolved from the product server-side
  // (client-supplied values for a product line are ignored) and the sale
  // decrements lib/inventory stock — see the Quick Sale flow.
  productId:    z.string().uuid().optional(),
  description:  z.string().min(1).max(500).optional(),
  quantity:     z.number().positive().default(1),
  unitPrice:    z.number().nonnegative().optional(),
  vatRate:      z.number().min(0).max(1).default(0.15),
}).refine(li => li.productId || (li.description && li.unitPrice !== undefined), {
  message: 'Each line item needs either a productId or a description + unitPrice',
})

const createSchema = z.object({
  contactId:    z.string().uuid().optional(),
  contactName:  z.string().max(200).optional(),   // free-text recipient when no contact is linked
  lineItems:    z.array(lineItemSchema).min(1),
  dueDate:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes:        z.string().max(2000).optional(),
  reference:    z.string().max(100).optional(),
  currency:     z.string().default('ZAR'),
  category:      z.string().optional(),
  paymentMethod: z.enum(['cash','card','eft','mobile_money','other']).optional(),
  // A Quick Sale (walk-in / POS-style) is paid at the point of creation —
  // the server forces status/amount_paid/amount_due, it isn't client-set.
  channel:      z.enum(['invoice','cash_sale']).default('invoice'),
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

  const category = isValidKey('income', body.category ?? '') ? body.category! : DEFAULT_INCOME_KEY

  // Resolve any product-linked line items (the Quick Sale / retail path) —
  // pull real name/price from `products` and confirm enough stock is on
  // hand for ALL of them before touching the database, so a sale never
  // gets half-created against an item that turns out to be short.
  const productIds = [...new Set(body.lineItems.map(li => li.productId).filter((id): id is string => Boolean(id)))]
  const productsById = new Map<string, { id: string; name: string; unit_price: number | null; current_stock: number }>()
  if (productIds.length) {
    const { data: products } = await supabaseAdmin
      .from('products')
      .select('id, name, unit_price, current_stock')
      .eq('tenant_id', tenantId)
      .in('id', productIds)
    for (const p of products ?? []) productsById.set(p.id, p)

    for (const li of body.lineItems) {
      if (!li.productId) continue
      const product = productsById.get(li.productId)
      if (!product) return NextResponse.json({ error: `Product ${li.productId} not found` }, { status: 404 })
      if (product.current_stock < li.quantity) {
        return NextResponse.json({ error: `Not enough stock for ${product.name} (${product.current_stock} on hand, ${li.quantity} requested)` }, { status: 422 })
      }
    }
  }

  // Calculate totals
  let subtotal = 0
  let vatTotal = 0

  const lineItemsWithTotals = body.lineItems.map(item => {
    const product = item.productId ? productsById.get(item.productId) : undefined
    const description = product ? product.name : item.description!
    const unitPrice   = product ? Number(product.unit_price ?? 0) : item.unitPrice!
    const lineSubtotal = item.quantity * unitPrice
    const lineVat      = lineSubtotal * item.vatRate
    subtotal += lineSubtotal
    vatTotal += lineVat
    return { ...item, description, unitPrice, line_subtotal: lineSubtotal, line_vat: lineVat }
  })

  const total = subtotal + vatTotal
  const isCashSale = body.channel === 'cash_sale'

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
  let contactPhone: string | null = null
  if (body.contactId) {
    const { data: contact } = await supabaseAdmin
      .from('contacts')
      .select('full_name, phone, wa_id')
      .eq('id', body.contactId)
      .eq('tenant_id', tenantId)
      .single()
    if (contact?.full_name) contactName = contact.full_name
    contactPhone = (contact?.phone || contact?.wa_id) ?? null
  }
  if (!contactName) contactName = 'Cash sale'

  const { data, error } = await supabaseAdmin
    .from('invoices')
    .insert({
      tenant_id:      tenantId,
      contact_id:     body.contactId  ?? null,
      contact_name:   contactName,
      contact_phone:  contactPhone,
      invoice_number: invoiceNumber,
      line_items:     lineItemsWithTotals,
      subtotal,
      vat_amount:     vatTotal,
      total,
      amount:         total,   // canonical value column the whole app reads
      amount_paid:    isCashSale ? total : 0,
      amount_due:     isCashSale ? 0 : total,
      currency:       body.currency,
      due_date:       body.dueDate   ?? null,
      notes:          body.notes     ?? null,
      reference:      body.reference ?? null,
      category,
      channel:        body.channel,
      payment_method: body.paymentMethod ?? null,
      status:         isCashSale ? 'paid' : 'sent',
      paid_at:        isCashSale ? new Date().toISOString() : null,
      created_by:     user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Decrement stock for any product-linked line items — best-effort per item
  // (mirrors app/api/inventory/transactions/route.ts's 'sell' path); a
  // failure here doesn't undo the sale, but is logged loudly since it means
  // stock and the sale record have gone out of sync.
  for (const item of lineItemsWithTotals) {
    if (!item.productId) continue
    const product = productsById.get(item.productId)!
    const newStock = product.current_stock - item.quantity
    const [{ error: txErr }] = await Promise.all([
      supabaseAdmin.from('inventory_transactions').insert({
        tenant_id: tenantId, product_id: item.productId, transaction_type: 'sell',
        quantity: -item.quantity, reference: invoiceNumber, notes: 'Quick Sale', created_by: user.id,
      }),
      supabaseAdmin.from('products').update({ current_stock: newStock }).eq('id', item.productId),
    ])
    if (txErr) console.error(`[invoices] stock decrement failed for product ${item.productId}`, txErr.message)
  }

  fireBusinessEvent('invoice.created', tenantId, user.id)

  if (isCashSale) {
    await handleInvoicePaid({
      id: data.id,
      tenant_id: tenantId,
      contact_name: data.contact_name,
      contact_phone: data.contact_phone,
      amount: data.amount,
      amount_paid: data.amount_paid,
      reference: data.reference,
    }, user.id)
  } else {
    // Update formalization progress (cash sales already covered inside
    // handleInvoicePaid above).
    await supabaseAdmin
      .from('formalization_progress')
      .update({ first_invoice_sent: true })
      .eq('tenant_id', tenantId)
      .eq('first_invoice_sent', false)
  }

  return NextResponse.json(data, { status: 201 })
}
