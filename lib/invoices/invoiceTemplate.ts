import { formatZAR } from '@/lib/format'
import { escHtml, DOC_PRINT_CSS } from '@/lib/documents/htmlDoc'

export interface InvoiceLineItem {
  description: string
  quantity: number
  unitPrice: number
  vatRate: number
  line_subtotal: number
  line_vat: number
}

export interface InvoiceDocData {
  invoiceNumber: string
  issueDate: string
  dueDate: string | null
  status: string
  companyName: string
  companyAddress: string | null
  companyVatNumber: string | null
  logoUrl: string | null
  billToName: string
  billToEmail: string | null
  billToPhone: string | null
  lineItems: InvoiceLineItem[]
  subtotal: number
  vatAmount: number
  total: number
  amountPaid: number
  amountDue: number
  notes: string | null
  bankName: string | null
  bankAccountHolder: string | null
  bankAccountNumber: string | null
  bankBranchCode: string | null
}

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  sent: 'Awaiting payment',
  unpaid: 'Unpaid',
  partial: 'Partially paid',
  paid: 'Paid',
  overdue: 'Overdue',
  in_collections: 'In collections',
  cancelled: 'Cancelled',
}

export function generateInvoiceHTML(data: InvoiceDocData): string {
  // SARS only permits the "Tax Invoice" heading + a VAT breakdown when the
  // supplier is VAT-registered — hide both, not just relabel, when there's
  // no VAT number on file.
  const isVatRegistered = !!data.companyVatNumber
  const docTitle = isVatRegistered ? 'TAX INVOICE' : 'INVOICE'

  const lineRows = data.lineItems
    .map(
      (item) => `<tr>
        <td>${escHtml(item.description)}</td>
        <td class="num">${item.quantity}</td>
        <td class="num">${formatZAR(item.unitPrice, { cents: true })}</td>
        ${isVatRegistered ? `<td class="num">${formatZAR(item.line_vat, { cents: true })}</td>` : ''}
        <td class="num">${formatZAR(item.line_subtotal + (isVatRegistered ? item.line_vat : 0), { cents: true })}</td>
      </tr>`
    )
    .join('')

  const hasBanking = !!(data.bankName || data.bankAccountNumber)

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escHtml(docTitle)} ${escHtml(data.invoiceNumber)} — ${escHtml(data.companyName)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #111; background: #fff; padding: 24px; }
  .doc { max-width: 800px; margin: 0 auto; border: 1px solid #ccc; padding: 24px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; border-bottom: 2px solid #1a56db; padding-bottom: 16px; }
  .brand { display: flex; align-items: center; gap: 12px; }
  .brand img { max-height: 48px; max-width: 160px; object-fit: contain; }
  .company-name { font-size: 18px; font-weight: bold; color: #1a56db; }
  .company-details { font-size: 10px; color: #555; margin-top: 4px; }
  .doc-title { text-align: right; }
  .doc-title h1 { font-size: 16px; font-weight: bold; color: #1a56db; letter-spacing: 0.5px; }
  .doc-title .meta { font-size: 11px; color: #555; margin-top: 4px; }
  .status-badge { display: inline-block; margin-top: 6px; padding: 2px 10px; border-radius: 999px; font-size: 10px; font-weight: bold; text-transform: uppercase; }
  .status-paid { background: #dcfce7; color: #166534; }
  .status-overdue, .status-in_collections { background: #fee2e2; color: #991b1b; }
  .status-other { background: #f1f5f9; color: #475569; }
  .bill-to { background: #f8fafc; padding: 12px; border-radius: 4px; margin-bottom: 16px; }
  .bill-to .label { font-size: 9px; text-transform: uppercase; color: #888; margin-bottom: 4px; }
  .bill-to .value { font-size: 12px; font-weight: bold; }
  .bill-to .sub { font-size: 10px; color: #555; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
  th { background: #1a56db; color: #fff; padding: 6px 8px; text-align: left; font-size: 10px; }
  th.num, td.num { text-align: right; }
  td { padding: 6px 8px; border-bottom: 1px solid #eee; }
  tr:last-child td { border-bottom: none; }
  .totals { display: flex; justify-content: flex-end; margin-top: 8px; }
  .totals table { width: 260px; margin-bottom: 0; }
  .totals td { padding: 4px 8px; border-bottom: none; }
  .totals .grand td { font-size: 13px; font-weight: bold; border-top: 2px solid #1a56db; padding-top: 8px; }
  .notes { margin-top: 16px; font-size: 10px; color: #555; }
  .footer-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 16px; background: #f8fafc; padding: 10px; border-radius: 4px; font-size: 10px; color: #555; }
  .generated-note { text-align: center; margin-top: 16px; font-size: 9px; color: #aaa; }
  ${DOC_PRINT_CSS}
</style>
</head>
<body>
<div class="doc">

  <div class="header">
    <div class="brand">
      ${data.logoUrl ? `<img src="${escHtml(data.logoUrl)}" alt="${escHtml(data.companyName)} logo">` : ''}
      <div>
        <div class="company-name">${escHtml(data.companyName)}</div>
        ${data.companyAddress ? `<div class="company-details">${escHtml(data.companyAddress)}</div>` : ''}
        ${isVatRegistered ? `<div class="company-details">VAT No: ${escHtml(data.companyVatNumber!)}</div>` : ''}
      </div>
    </div>
    <div class="doc-title">
      <h1>${escHtml(docTitle)}</h1>
      <div class="meta">${escHtml(data.invoiceNumber)}</div>
      <div class="meta">Issued: ${escHtml(data.issueDate)}</div>
      ${data.dueDate ? `<div class="meta">Due: <strong>${escHtml(data.dueDate)}</strong></div>` : ''}
      <div class="status-badge ${data.status === 'paid' ? 'status-paid' : data.status === 'overdue' || data.status === 'in_collections' ? 'status-overdue' : 'status-other'}">
        ${escHtml(STATUS_LABEL[data.status] ?? data.status)}
      </div>
    </div>
  </div>

  <div class="bill-to">
    <div class="label">Bill To</div>
    <div class="value">${escHtml(data.billToName)}</div>
    ${data.billToEmail ? `<div class="sub">${escHtml(data.billToEmail)}</div>` : ''}
    ${data.billToPhone ? `<div class="sub">${escHtml(data.billToPhone)}</div>` : ''}
  </div>

  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th class="num">Qty</th>
        <th class="num">Unit Price</th>
        ${isVatRegistered ? '<th class="num">VAT</th>' : ''}
        <th class="num">Amount</th>
      </tr>
    </thead>
    <tbody>${lineRows}</tbody>
  </table>

  <div class="totals">
    <table>
      <tbody>
        <tr><td>Subtotal</td><td class="num">${formatZAR(data.subtotal, { cents: true })}</td></tr>
        ${isVatRegistered ? `<tr><td>VAT</td><td class="num">${formatZAR(data.vatAmount, { cents: true })}</td></tr>` : ''}
        <tr class="grand"><td>Total</td><td class="num">${formatZAR(data.total, { cents: true })}</td></tr>
        ${data.amountPaid > 0 ? `<tr><td>Paid</td><td class="num">${formatZAR(data.amountPaid, { cents: true })}</td></tr>
        <tr><td><strong>Balance due</strong></td><td class="num"><strong>${formatZAR(data.amountDue, { cents: true })}</strong></td></tr>` : ''}
      </tbody>
    </table>
  </div>

  ${data.notes ? `<div class="notes"><strong>Notes:</strong> ${escHtml(data.notes)}</div>` : ''}

  ${hasBanking ? `
  <div class="footer-row">
    <div>
      <strong>Banking Details</strong><br>
      ${data.bankName ? `Bank: ${escHtml(data.bankName)}<br>` : ''}
      ${data.bankAccountHolder ? `Account holder: ${escHtml(data.bankAccountHolder)}<br>` : ''}
      ${data.bankAccountNumber ? `Account number: ${escHtml(data.bankAccountNumber)}<br>` : ''}
      ${data.bankBranchCode ? `Branch code: ${escHtml(data.bankBranchCode)}<br>` : ''}
      Use <strong>${escHtml(data.invoiceNumber)}</strong> as your payment reference.
    </div>
    <div>
      <strong>Note</strong><br>
      This invoice is generated electronically and is valid without a signature.
    </div>
  </div>` : ''}

  <div class="generated-note">Generated by AdminOS — ${escHtml(data.companyName)} | ${new Date().toLocaleDateString('en-ZA')}</div>

</div>
</body>
</html>`
}
