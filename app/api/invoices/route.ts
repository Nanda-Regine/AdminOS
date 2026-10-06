import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'
import { fireBusinessEvent } from '@/lib/academy/knowledgeGraph'
import { handleInvoicePaid } from '@/lib/invoices/onPaid'
import { isValidKey, DEFAULT_INCOME_KEY } from '@/lib/finance/chartOfAccounts'
import { INVOICE_STATUSES, OPEN_INVOICE_STATUSES } from '@/lib/invoices/status'
import { todayDateString } from '@/lib/debt/overdue'
import { adjustStock } from '@/lib/inventory/stock'
import { withRoute, unwrap, notFound, conflict, RouteError } from '@/lib/api/withRoute'

const LIST_COLUMNS =
  'id, invoice_number, contact_id, contact_name, contact_email, contact_phone, amount, amount_paid, amount_due, ' +
  'currency, status, due_date, created_at, sent_at, paid_at, reference, category, channel, payment_method, ' +
  'recovery_status, recovery_tier, contact:contacts(name:full_name, email, phone)'

const listQuery = z.object({
  status:    z.enum(INVOICE_STATUSES).optional(),
  contactId: z.string().uuid().optional(),
  from:      z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional(),
  to:        z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional(),
  overdue:   z.enum(['true', 'false']).optional(),
  limit:     z.coerce.number().int().min(1).max(200).default(50),
})

export const GET = withRoute({ action: 'invoices.read', query: listQuery }, async ({ ctx, query }) => {
  let q = supabaseAdmin
    .from('invoices')
    .select(LIST_COLUMNS)
    .eq('tenant_id', ctx.tenantId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(query.limit)

  if (query.status)    q = q.eq('status', query.status)
  if (query.contactId) q = q.eq('contact_id', query.contactId)
  if (query.from)      q = q.gte('created_at', query.from)
  if (query.to)        q = q.lte('created_at', query.to)
  // Overdue = open and past its due date. Not days_overdue: that column is
  // only recomputed on write and goes stale (lib/invoices/status).
  if (query.overdue === 'true') q = q.in('status', [...OPEN_INVOICE_STATUSES]).lt('due_date', todayDateString())

  return unwrap(await q) ?? []
})

const lineItemSchema = z.object({
  // When set, description/unitPrice are resolved from the product server-side
  // (client-supplied values for a product line are ignored) and the sale
  // decrements stock — see the Quick Sale flow.
  productId:    z.string().uuid().optional(),
  description:  z.string().min(1).max(500).optional(),
  quantity:     z.number().positive().max(1_000_000).default(1),
  unitPrice:    z.number().nonnegative().max(100_000_000).optional(),
  vatRate:      z.union([z.literal(0), z.literal(0.15)]).default(0),   // SA standard rate or none
}).refine(li => li.productId || (li.description && li.unitPrice !== undefined), {
  message: 'Each line item needs either a productId or a description + unitPrice',
}).refine(li => !li.productId || Number.isInteger(li.quantity), {
  message: 'Stock items are sold in whole units',
  path: ['quantity'],
})

const createSchema = z.object({
  contactId:    z.string().uuid().optional(),
  contactName:  z.string().max(200).optional(),   // free-text recipient when no contact is linked
  lineItems:    z.array(lineItemSchema).min(1).max(200),
  dueDate:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes:        z.string().max(2000).optional(),
  reference:    z.string().max(100).optional(),
  currency:     z.literal('ZAR').default('ZAR'),
  category:      z.string().max(100).optional(),
  paymentMethod: z.enum(['cash','card','eft','mobile_money','other']).optional(),
  // A Quick Sale (walk-in / POS-style) is paid at the point of creation —
  // the server forces status/amount_paid/amount_due, it isn't client-set.
  channel:      z.enum(['invoice','cash_sale']).default('invoice'),
})

const round2 = (n: number) => Math.round(n * 100) / 100

export const POST = withRoute({
  action: 'invoices.write',
  body: createSchema,
  status: 201,
  audit: 'invoice.created',
  resourceType: 'invoice',
  rateLimit: 'api',
}, async ({ ctx, body }) => {
  const { tenantId, userId } = ctx
  const category = isValidKey('income', body.category ?? '') ? body.category! : DEFAULT_INCOME_KEY
  const isCashSale = body.channel === 'cash_sale'

  // ── Products (Quick Sale / retail lines) ──────────────────────────────────
  const productIds = [...new Set(body.lineItems.map(li => li.productId).filter((id): id is string => Boolean(id)))]
  const productsById = new Map<string, { id: string; name: string; unit_price: number | null; current_stock: number }>()
  if (productIds.length) {
    const products = unwrap(await supabaseAdmin
      .from('products')
      .select('id, name, unit_price, current_stock')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .in('id', productIds)) ?? []
    for (const p of products) productsById.set(p.id, p)
    for (const li of body.lineItems) {
      if (li.productId && !productsById.has(li.productId)) throw notFound('One of the products on this sale no longer exists.')
    }
  }

  // ── VAT only for VAT-registered businesses. Both modals defaulted "Include
  //    15% VAT" to on for everyone, while the document hides the VAT line when
  //    there's no VAT number — so non-registered businesses billed 15% more than
  //    their line items, with no VAT shown. Charging VAT unregistered is unlawful.
  if (body.lineItems.some(li => li.vatRate > 0)) {
    const tenant = unwrap(await supabaseAdmin.from('tenants').select('settings').eq('id', tenantId).maybeSingle())
    const vatNumber = (tenant?.settings as { vat_number?: string } | null)?.vat_number?.trim()
    if (!vatNumber) {
      throw new RouteError(400, 'Only VAT-registered businesses can charge VAT. Add your VAT number in Settings, or remove VAT from this invoice.', 'vat_not_registered')
    }
  }

  // ── Totals (rounded to cents per line, so documents and totals agree) ─────
  let subtotal = 0
  let vatTotal = 0
  const lineItemsWithTotals = body.lineItems.map(item => {
    const product = item.productId ? productsById.get(item.productId) : undefined
    const description = product ? product.name : item.description!
    const unitPrice   = product ? Number(product.unit_price ?? 0) : item.unitPrice!
    const lineSubtotal = round2(item.quantity * unitPrice)
    const lineVat      = round2(lineSubtotal * item.vatRate)
    subtotal += lineSubtotal
    vatTotal += lineVat
    return { ...item, description, unitPrice, line_subtotal: lineSubtotal, line_vat: lineVat }
  })
  subtotal = round2(subtotal)
  vatTotal = round2(vatTotal)
  const total = round2(subtotal + vatTotal)

  // ── Take stock first, atomically. Each decrement either succeeds in full or
  //    returns null (short / gone); on any failure, put back what was taken.
  //    The old flow checked stock, created the invoice, then wrote
  //    current_stock - qty computed from the earlier read — two simultaneous
  //    sales both succeeded against the same unit. ───────────────────────────
  const taken: { productId: string; qty: number }[] = []
  const putBack = async () => {
    for (const t of taken) await adjustStock(tenantId, t.productId, t.qty).catch(() => null)
  }
  // Merge repeated lines of the same product into one decrement.
  const qtyByProduct = new Map<string, number>()
  for (const li of body.lineItems) if (li.productId) qtyByProduct.set(li.productId, (qtyByProduct.get(li.productId) ?? 0) + li.quantity)
  for (const [productId, qty] of qtyByProduct) {
    const left = await adjustStock(tenantId, productId, -qty)
    if (left === null) {
      await putBack()
      const p = productsById.get(productId)!
      throw new RouteError(422, `Not enough stock for ${p.name} (${qty} requested).`, 'insufficient_stock')
    }
    taken.push({ productId, qty })
  }

  let created: Record<string, unknown> | null = null
  try {
    // ── Recipient. contact_name is NOT NULL and is what lists/exports/recovery read.
    let contactName = body.contactName?.trim() || null
    let contactPhone: string | null = null
    let contactEmail: string | null = null
    if (body.contactId) {
      const contact = unwrap(await supabaseAdmin
        .from('contacts')
        .select('full_name, phone, wa_id, email')
        .eq('id', body.contactId)
        .eq('tenant_id', tenantId)
        .is('deleted_at', null)
        .maybeSingle(), { required: true, what: 'That contact no longer exists.' })
      if (contact.full_name) contactName = contact.full_name
      contactPhone = (contact.phone || contact.wa_id) ?? null
      contactEmail = contact.email ?? null
    }
    if (!contactName) contactName = 'Cash sale'

    // ── Number: INV-YYYYMMDD-NNNN. count+1 collides when two invoices are
    //    created at once; the unique index (tenant_id, invoice_number) turns
    //    that into a 23505 and we take the next number.
    const today = todayDateString().replace(/-/g, '')
    const { count } = await supabaseAdmin
      .from('invoices')
      .select('id', { count: 'exact', head: true }).is('deleted_at', null)
      .eq('tenant_id', tenantId)

    const nowIso = new Date().toISOString()
    let invoiceNumber = ''
    for (let attempt = 0; attempt < 5 && !created; attempt++) {
      invoiceNumber = `INV-${today}-${String((count ?? 0) + 1 + attempt).padStart(4, '0')}`
      const res = await supabaseAdmin
        .from('invoices')
        .insert({
          tenant_id:      tenantId,
          contact_id:     body.contactId ?? null,
          contact_name:   contactName,
          contact_phone:  contactPhone,
          contact_email:  contactEmail,
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
          sent_at:        isCashSale ? null : nowIso,
          paid_at:        isCashSale ? nowIso : null,
          created_by:     userId,
        })
        .select()
        .single()
      if (res.error?.code === '23505') continue
      created = unwrap(res)
    }
    if (!created) throw conflict('Could not allocate an invoice number — please try again.')
    const data = created as {
      id: string; contact_name: string | null; contact_phone: string | null
      amount: number; amount_paid: number | null; reference: string | null
    }

    // Stock ledger rows (the movement itself already happened atomically above).
    if (taken.length) {
      const { error: txErr } = await supabaseAdmin.from('inventory_transactions').insert(taken.map(t => ({
        tenant_id: tenantId, product_id: t.productId, transaction_type: 'sell',
        quantity: -t.qty, reference: invoiceNumber, notes: isCashSale ? 'Quick Sale' : 'Invoice', created_by: userId,
      })))
      if (txErr) console.error('[invoices] stock ledger insert failed', invoiceNumber, txErr.message)
    }

    fireBusinessEvent('invoice.created', tenantId, userId)

    if (isCashSale) {
      await handleInvoicePaid({
        id: data.id, tenant_id: tenantId, contact_name: data.contact_name, contact_phone: data.contact_phone,
        amount: data.amount, amount_paid: data.amount_paid, reference: data.reference,
      }, userId)
    } else {
      await supabaseAdmin
        .from('formalization_progress')
        .update({ first_invoice_sent: true })
        .eq('tenant_id', tenantId)
        .eq('first_invoice_sent', false)
    }

    return created
  } catch (e) {
    // Return the stock only if the sale itself was never recorded. A failure in
    // a side effect after the insert (ledger, notifications) must not undo stock
    // for a sale that exists.
    if (!created) await putBack()
    throw e
  }
})
