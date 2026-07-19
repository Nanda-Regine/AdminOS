interface PayslipData {
  logoUrl?:        string | null
  employeeName:    string
  employeeNumber:  string
  idNumber:        string | null
  position:        string | null
  department:      string | null
  periodStart:     string
  periodEnd:       string
  payDate:         string
  companyName:     string
  companyAddress:  string | null
  companyVatNumber: string | null
  earnings:        Array<{ description: string; amount: number }>
  deductions:      Array<{ description: string; amount: number }>
  grossPay:        number
  totalDeductions: number
  netPay:          number
  ytdGross:        number | null
  ytdTax:          number | null
  bankName:        string | null
  accountNumber:   string | null
  uifNumber:       string | null
}

function formatZAR(amount: number): string {
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(amount)
}

export function generatePayslipHTML(data: PayslipData): string {
  const earningsRows = data.earnings
    .map(e => `<tr><td>${escHtml(e.description)}</td><td class="amount">${formatZAR(e.amount)}</td></tr>`)
    .join('')

  const deductionRows = data.deductions
    .map(d => `<tr><td>${escHtml(d.description)}</td><td class="amount">${formatZAR(d.amount)}</td></tr>`)
    .join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Payslip — ${escHtml(data.employeeName)} — ${escHtml(data.payDate)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #111; background: #fff; padding: 24px; }
  .payslip { max-width: 800px; margin: 0 auto; border: 1px solid #ccc; padding: 24px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; border-bottom: 2px solid #1a56db; padding-bottom: 16px; }
  .brand { display: flex; align-items: center; gap: 12px; }
  .brand img { max-height: 48px; max-width: 160px; object-fit: contain; }
  .company-name { font-size: 18px; font-weight: bold; color: #1a56db; }
  .company-details { font-size: 10px; color: #555; margin-top: 4px; }
  .payslip-title { text-align: right; }
  .payslip-title h1 { font-size: 16px; font-weight: bold; color: #1a56db; }
  .payslip-title .period { font-size: 11px; color: #555; margin-top: 4px; }
  .employee-section { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; background: #f8fafc; padding: 12px; border-radius: 4px; margin-bottom: 16px; }
  .employee-section .label { font-size: 9px; text-transform: uppercase; color: #888; margin-bottom: 2px; }
  .employee-section .value { font-size: 11px; font-weight: bold; }
  .tables-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #1a56db; color: #fff; padding: 6px 8px; text-align: left; font-size: 10px; }
  td { padding: 5px 8px; border-bottom: 1px solid #eee; }
  td.amount { text-align: right; }
  tr:last-child td { border-bottom: none; }
  .totals-section { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-top: 12px; }
  .total-box { border: 1px solid #ddd; border-radius: 4px; padding: 10px; text-align: center; }
  .total-box.net { background: #1a56db; color: #fff; border-color: #1a56db; }
  .total-box .total-label { font-size: 9px; text-transform: uppercase; margin-bottom: 4px; }
  .total-box .total-amount { font-size: 14px; font-weight: bold; }
  .footer-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 16px; background: #f8fafc; padding: 10px; border-radius: 4px; font-size: 10px; color: #555; }
  .generated-note { text-align: center; margin-top: 16px; font-size: 9px; color: #aaa; }
  @media print {
    body { padding: 0; }
    .payslip { border: none; box-shadow: none; }
    @page { size: A4; margin: 20mm; }
  }
  @media screen { body { background: #eee; } .payslip { box-shadow: 0 2px 12px rgba(0,0,0,0.12); } }
</style>
</head>
<body>
<div class="payslip">

  <div class="header">
    <div class="brand">
      ${data.logoUrl ? `<img src="${escHtml(data.logoUrl)}" alt="${escHtml(data.companyName)} logo">` : ''}
      <div>
        <div class="company-name">${escHtml(data.companyName)}</div>
        ${data.companyAddress ? `<div class="company-details">${escHtml(data.companyAddress)}</div>` : ''}
        ${data.companyVatNumber ? `<div class="company-details">VAT: ${escHtml(data.companyVatNumber)}</div>` : ''}
      </div>
    </div>
    <div class="payslip-title">
      <h1>PAYSLIP</h1>
      <div class="period">Pay Period: ${escHtml(data.periodStart)} – ${escHtml(data.periodEnd)}</div>
      <div class="period">Pay Date: <strong>${escHtml(data.payDate)}</strong></div>
    </div>
  </div>

  <div class="employee-section">
    <div>
      <div class="label">Employee Name</div>
      <div class="value">${escHtml(data.employeeName)}</div>
    </div>
    <div>
      <div class="label">Employee Number</div>
      <div class="value">${escHtml(data.employeeNumber)}</div>
    </div>
    ${data.idNumber ? `<div><div class="label">ID Number</div><div class="value">${escHtml(data.idNumber)}</div></div>` : '<div></div>'}
    ${data.position ? `<div><div class="label">Position</div><div class="value">${escHtml(data.position)}</div></div>` : '<div></div>'}
    ${data.department ? `<div><div class="label">Department</div><div class="value">${escHtml(data.department)}</div></div>` : '<div></div>'}
    ${data.uifNumber ? `<div><div class="label">UIF Reference</div><div class="value">${escHtml(data.uifNumber)}</div></div>` : '<div></div>'}
  </div>

  <div class="tables-row">
    <div>
      <table>
        <thead><tr><th>EARNINGS</th><th>AMOUNT</th></tr></thead>
        <tbody>${earningsRows}</tbody>
      </table>
    </div>
    <div>
      <table>
        <thead><tr><th>DEDUCTIONS</th><th>AMOUNT</th></tr></thead>
        <tbody>
          ${deductionRows || '<tr><td colspan="2" style="text-align:center;color:#aaa">No deductions</td></tr>'}
        </tbody>
      </table>
    </div>
  </div>

  <div class="totals-section">
    <div class="total-box">
      <div class="total-label">Gross Pay</div>
      <div class="total-amount">${formatZAR(data.grossPay)}</div>
    </div>
    <div class="total-box">
      <div class="total-label">Total Deductions</div>
      <div class="total-amount">${formatZAR(data.totalDeductions)}</div>
    </div>
    <div class="total-box net">
      <div class="total-label">Net Pay</div>
      <div class="total-amount">${formatZAR(data.netPay)}</div>
    </div>
  </div>

  ${(data.ytdGross !== null || data.ytdTax !== null) ? `
  <div style="margin-top:12px;font-size:10px;color:#555;">
    <strong>Year-to-Date:</strong>
    ${data.ytdGross !== null ? `Gross ${formatZAR(data.ytdGross)}` : ''}
    ${data.ytdTax !== null ? `| PAYE ${formatZAR(data.ytdTax)}` : ''}
  </div>` : ''}

  ${(data.bankName || data.accountNumber) ? `
  <div class="footer-row">
    <div>
      <strong>Banking Details</strong><br>
      ${data.bankName ? `Bank: ${escHtml(data.bankName)}<br>` : ''}
      ${data.accountNumber ? `Account: ${escHtml(data.accountNumber)}` : ''}
    </div>
    <div>
      <strong>Note</strong><br>
      This payslip is generated electronically and is valid without a signature.
    </div>
  </div>` : ''}

  <div class="generated-note">Generated by AdminOS — ${escHtml(data.companyName)} | ${new Date().toLocaleDateString('en-ZA')}</div>

</div>
</body>
</html>`
}

function escHtml(str: string): string {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}
