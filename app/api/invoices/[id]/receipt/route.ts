import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { checkPermission } from '@/lib/auth/permissions'
import { generateReceiptHTML } from '@/lib/invoices/receiptTemplate'

// GET /api/invoices/[id]/receipt — printable payment-receipt HTML.
// Only available once the invoice has a payment recorded against it.
// Add ?download=true for Content-Disposition: attachment.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.app_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  if (!(await checkPermission('manage_invoices'))) return new NextResponse('Forbidden', { status: 403 })

  const { id } = await params

  const { data: invoice, error } = await supabaseAdmin
    .from('invoices')
    .select('*, contact:contacts(name:full_name)')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single()

  if (error || !invoice) return new NextResponse('Not found', { status: 404 })

  if (!invoice.amount_paid || invoice.amount_paid <= 0) {
    return NextResponse.json({ error: 'No payment has been recorded against this invoice yet.' }, { status: 409 })
  }

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
      ? new Date(invoice.paid_at).toLocaleDateString('en-ZA')
      : new Date().toLocaleDateString('en-ZA'),
    companyName:      tenant?.name ?? 'Company',
    companyAddress:   settings?.address ?? null,
    companyVatNumber: settings?.vat_number ?? null,
    logoUrl:          settings?.logo_url ?? null,
    paidByName:       contact?.name ?? invoice.contact_name ?? 'Customer',
    amountPaid:       invoice.amount_paid,
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
}
