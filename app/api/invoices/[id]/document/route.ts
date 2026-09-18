import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { checkPermission } from '@/lib/auth/permissions'
import { generateInvoiceHTML, type InvoiceLineItem } from '@/lib/invoices/invoiceTemplate'

// GET /api/invoices/[id]/document — printable tax invoice HTML.
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
    .select('*, contact:contacts(name:full_name, email, phone)')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single()

  if (error || !invoice) return new NextResponse('Not found', { status: 404 })

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
    total:             invoice.total ?? invoice.amount ?? 0,
    amountPaid:        invoice.amount_paid ?? 0,
    amountDue:         invoice.amount_due ?? Math.max(0, (invoice.total ?? invoice.amount ?? 0) - (invoice.amount_paid ?? 0)),
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
}
