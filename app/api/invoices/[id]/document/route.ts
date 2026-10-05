import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { generateInvoiceHTML, type InvoiceLineItem } from '@/lib/invoices/invoiceTemplate'
import { outstanding } from '@/lib/invoices/status'
import { withRoute, unwrap } from '@/lib/api/withRoute'

// GET /api/invoices/[id]/document — printable tax invoice HTML.
// Add ?download=true for Content-Disposition: attachment.
export const GET = withRoute({ action: 'invoices.read' }, async ({ request, ctx, params }) => {
  const { tenantId } = ctx

  const invoice = unwrap(await supabaseAdmin
    .from('invoices')
    .select('*, contact:contacts(name:full_name, email, phone)')
    .eq('id', params.id)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .maybeSingle(), { required: true, what: 'Invoice not found' })

  const { data: tenant } = await supabaseAdmin
    .from('tenants')
    .select('name, settings')
    .eq('id', tenantId)
    .single()

  const settings = (tenant?.settings as Record<string, string> | null) ?? null
  const contact  = invoice.contact as { name?: string; email?: string; phone?: string } | null

  const html = generateInvoiceHTML({
    invoiceNumber:     invoice.invoice_number ?? invoice.id.slice(0, 8),
    issueDate:         new Date(invoice.created_at).toLocaleDateString('en-ZA'),
    dueDate:           invoice.due_date ? new Date(invoice.due_date).toLocaleDateString('en-ZA') : null,
    status:            invoice.status,
    companyName:       tenant?.name ?? 'Company',
    companyAddress:    settings?.address ?? null,
    companyVatNumber:  settings?.vat_number ?? null,
    logoUrl:           settings?.logo_url ?? null,
    billToName:        contact?.name ?? invoice.contact_name ?? 'Customer',
    billToEmail:       contact?.email ?? invoice.contact_email ?? null,
    billToPhone:       contact?.phone ?? invoice.contact_phone ?? null,
    lineItems:         (invoice.line_items as InvoiceLineItem[] | null) ?? [],
    subtotal:          invoice.subtotal ?? invoice.amount ?? 0,
    vatAmount:         invoice.vat_amount ?? 0,
    // amount is canonical; `total` is vestigial and amount_due is stale on older rows.
    total:             invoice.amount ?? invoice.total ?? 0,
    amountPaid:        invoice.amount_paid ?? 0,
    amountDue:         invoice.status === 'cancelled' ? 0 : outstanding(invoice),
    notes:             invoice.notes ?? null,
    bankName:          settings?.bank_name ?? null,
    bankAccountHolder: settings?.bank_account_holder ?? null,
    bankAccountNumber: settings?.bank_account_number ?? null,
    bankBranchCode:    settings?.bank_branch_code ?? null,
  })

  const url      = new URL(request.url)
  const download = url.searchParams.get('download') === 'true'

  const headers: Record<string, string> = {
    'Content-Type':  'text/html; charset=utf-8',
    'Cache-Control': 'private, no-store',
  }

  if (download) {
    headers['Content-Disposition'] = `attachment; filename="invoice-${invoice.invoice_number ?? invoice.id.slice(0, 8)}.html"`
  }

  return new NextResponse(html, { headers })
})
