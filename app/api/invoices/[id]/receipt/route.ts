import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { generateReceiptHTML } from '@/lib/invoices/receiptTemplate'
import { withRoute, unwrap, conflict } from '@/lib/api/withRoute'

// GET /api/invoices/[id]/receipt — printable payment-receipt HTML.
// Only available once the invoice has a payment recorded against it.
// Add ?download=true for Content-Disposition: attachment.
export const GET = withRoute({ action: 'invoices.read' }, async ({ request, ctx, params }) => {
  const { tenantId } = ctx

  const invoice = unwrap(await supabaseAdmin
    .from('invoices')
    .select('*, contact:contacts(name:full_name)')
    .eq('id', params.id)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .maybeSingle(), { required: true, what: 'Invoice not found' })

  if (!(Number(invoice.amount_paid) > 0)) throw conflict('No payment has been recorded against this invoice yet.')

  const { data: tenant } = await supabaseAdmin
    .from('tenants')
    .select('name, settings')
    .eq('id', tenantId)
    .single()

  const settings = (tenant?.settings as Record<string, string> | null) ?? null
  const contact  = invoice.contact as { name?: string } | null
  const invoiceNumber = invoice.invoice_number ?? invoice.id.slice(0, 8)

  const html = generateReceiptHTML({
    receiptNumber:    `RCT-${invoiceNumber}`,
    invoiceNumber,
    paidDate:         invoice.paid_at
      ? new Date(invoice.paid_at).toLocaleDateString('en-ZA', { timeZone: 'Africa/Johannesburg' })
      : new Date().toLocaleDateString('en-ZA', { timeZone: 'Africa/Johannesburg' }),
    companyName:      tenant?.name ?? 'Company',
    companyAddress:   settings?.address ?? null,
    companyVatNumber: settings?.vat_number ?? null,
    logoUrl:          settings?.logo_url ?? null,
    paidByName:       contact?.name ?? invoice.contact_name ?? 'Customer',
    amountPaid:       Number(invoice.amount_paid),
    isPartial:        invoice.status !== 'paid',
  })

  const url      = new URL(request.url)
  const download = url.searchParams.get('download') === 'true'

  const headers: Record<string, string> = {
    'Content-Type':  'text/html; charset=utf-8',
    'Cache-Control': 'private, no-store',
  }

  if (download) {
    headers['Content-Disposition'] = `attachment; filename="receipt-${invoiceNumber}.html"`
  }

  return new NextResponse(html, { headers })
})
