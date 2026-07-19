/**
 * Accountant-ready exports — the "operational finance brain that EXPORTS clean
 * coded working papers, it is not the system of record" pattern (from
 * BB-MotherShip-Deluxe `lib/finance/exports.ts`).
 *
 * Pure string builders — no DB, unit-testable. SA VAT = 15%. Amounts are treated
 * as VAT-INCLUSIVE (the SA SME default); every output is a WORKING PAPER for the
 * bookkeeper to confirm, not a filed return.
 */

export const VAT_RATE = 0.15

export interface ExportInvoice { contact_name: string | null; amount: number; amount_paid: number; status: string; created_at: string; due_date?: string | null }
export interface ExportExpense { category: string | null; description: string | null; amount: number; created_at: string; status: string }

const vatFromInclusive = (incl: number) => (incl * VAT_RATE) / (1 + VAT_RATE)
const zar = (n: number) => n.toFixed(2)
const csvCell = (v: string | number) => {
  const s = String(v ?? '')
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
const row = (cells: (string | number)[]) => cells.map(csvCell).join(',')
const inWindow = (iso: string, from?: string, to?: string) =>
  (!from || iso >= from) && (!to || iso <= to)

/** VAT201 working paper: output VAT (sales) vs input VAT (purchases) → net payable. */
export function buildVat201WorkingPaper(
  invoices: ExportInvoice[],
  expenses: ExportExpense[],
  period: { from?: string; to?: string; label?: string } = {},
): { csv: string; summary: { salesIncl: number; outputVat: number; purchasesIncl: number; inputVat: number; netPayable: number } } {
  const sales = invoices.filter(i => inWindow(i.created_at, period.from, period.to))
  const purch = expenses.filter(e => e.status !== 'rejected' && inWindow(e.created_at, period.from, period.to))

  const salesIncl = sales.reduce((s, i) => s + Number(i.amount || 0), 0)
  const outputVat = vatFromInclusive(salesIncl)
  const purchasesIncl = purch.reduce((s, e) => s + Number(e.amount || 0), 0)
  const inputVat = vatFromInclusive(purchasesIncl)
  const netPayable = outputVat - inputVat

  const lines = [
    ['AdminOS — VAT201 WORKING PAPER (estimate — confirm with your accountant)'],
    [`Period`, period.label ?? `${period.from ?? 'start'} to ${period.to ?? 'today'}`],
    [`VAT rate`, `${(VAT_RATE * 100).toFixed(0)}% (amounts treated as VAT-inclusive)`],
    [],
    ['Field', 'Description', 'Amount (ZAR)'],
    ['Block 1', 'Standard-rated sales (incl. VAT)', zar(salesIncl)],
    ['Block 4', 'OUTPUT VAT on sales', zar(outputVat)],
    ['Block 14', 'Standard-rated purchases (incl. VAT)', zar(purchasesIncl)],
    ['Block 15', 'INPUT VAT on purchases', zar(inputVat)],
    [],
    ['NET VAT', netPayable >= 0 ? 'Payable to SARS' : 'Refund due', zar(Math.abs(netPayable))],
  ]
  const csv = lines.map(l => (l.length === 0 ? '' : row(l))).join('\n')
  return { csv, summary: { salesIncl, outputVat, purchasesIncl, inputVat, netPayable } }
}

/** General-journal CSV (Xero/Sage-importable-ish): Date, Ref, Description, Account, Debit, Credit. */
export function buildJournalCsv(
  invoices: ExportInvoice[],
  expenses: ExportExpense[],
  period: { from?: string; to?: string } = {},
): string {
  const header = ['Date', 'Reference', 'Description', 'Account', 'Debit', 'Credit']
  const lines: (string | number)[][] = [header]

  const sales = invoices.filter(i => inWindow(i.created_at, period.from, period.to))
  for (const i of sales) {
    const d = i.created_at.slice(0, 10)
    const gross = Number(i.amount || 0)
    const vat = vatFromInclusive(gross)
    const net = gross - vat
    const ref = (i.contact_name || 'SALE').slice(0, 20)
    // AR debit gross; revenue credit net; VAT output credit
    lines.push([d, ref, `Invoice — ${i.contact_name ?? 'customer'}`, 'Accounts Receivable (1100)', zar(gross), ''])
    lines.push([d, ref, 'Sales revenue', 'Sales (4000)', '', zar(net)])
    lines.push([d, ref, 'Output VAT', 'VAT Control (2200)', '', zar(vat)])
  }

  const purch = expenses.filter(e => e.status !== 'rejected' && inWindow(e.created_at, period.from, period.to))
  for (const e of purch) {
    const d = e.created_at.slice(0, 10)
    const gross = Number(e.amount || 0)
    const vat = vatFromInclusive(gross)
    const net = gross - vat
    const acct = (e.category || 'General expenses').replace(/[_-]/g, ' ')
    lines.push([d, 'EXP', e.description || acct, `${acct} (5000)`, zar(net), ''])
    lines.push([d, 'EXP', 'Input VAT', 'VAT Control (2200)', zar(vat), ''])
    lines.push([d, 'EXP', 'Payable', 'Accounts Payable (2100)', '', zar(gross)])
  }

  return lines.map(row).join('\n')
}

// ── Monthly accountant pack (task #13) — each a clean, categorised working paper ──
const humanCat = (c: string | null) =>
  (c || 'Uncategorised').replace(/[_-]/g, ' ').replace(/\b\w/g, ch => ch.toUpperCase())

/** Income Statement (P&L): revenue net of VAT, expenses by category (net), net profit. */
export function buildIncomeStatement(
  invoices: ExportInvoice[],
  expenses: ExportExpense[],
  period: { from?: string; to?: string; label?: string } = {},
): string {
  const sales = invoices.filter(i => inWindow(i.created_at, period.from, period.to))
  const purch = expenses.filter(e => e.status !== 'rejected' && inWindow(e.created_at, period.from, period.to))
  const salesIncl = sales.reduce((s, i) => s + Number(i.amount || 0), 0)
  const revenueNet = salesIncl - vatFromInclusive(salesIncl)

  const byCat = new Map<string, number>()
  for (const e of purch) {
    const g = Number(e.amount || 0)
    byCat.set(humanCat(e.category), (byCat.get(humanCat(e.category)) || 0) + (g - vatFromInclusive(g)))
  }
  const totalExpNet = [...byCat.values()].reduce((a, b) => a + b, 0)
  const netProfit = revenueNet - totalExpNet

  const lines: (string | number)[][] = [
    ['AdminOS — INCOME STATEMENT (Profit & Loss) — working paper'],
    ['Period', period.label ?? `${period.from ?? 'start'} to ${period.to ?? 'today'}`],
    ['Basis', 'Amounts treated as VAT-inclusive at 15%; figures shown net of VAT'],
    [],
    ['REVENUE', 'Amount (ZAR)'],
    ['Sales revenue (net of VAT)', zar(revenueNet)],
    [],
    ['EXPENSES', 'Amount (ZAR)'],
    ...[...byCat.entries()].sort((a, b) => b[1] - a[1]).map(([cat, amt]) => [cat, zar(amt)] as (string | number)[]),
    ['Total expenses', zar(totalExpNet)],
    [],
    ['NET PROFIT / (LOSS)', zar(netProfit)],
  ]
  return lines.map(l => (l.length === 0 ? '' : row(l))).join('\n')
}

/** Expenses grouped by category — count, VAT-inclusive total, VAT, net. */
export function buildExpensesByCategory(
  expenses: ExportExpense[],
  period: { from?: string; to?: string } = {},
): string {
  const purch = expenses.filter(e => e.status !== 'rejected' && inWindow(e.created_at, period.from, period.to))
  const map = new Map<string, { count: number; incl: number }>()
  for (const e of purch) {
    const k = humanCat(e.category)
    const cur = map.get(k) ?? { count: 0, incl: 0 }
    cur.count++; cur.incl += Number(e.amount || 0)
    map.set(k, cur)
  }
  const lines: (string | number)[][] = [
    ['Category', 'Count', 'Total (incl VAT)', 'VAT', 'Net'],
    ...[...map.entries()].sort((a, b) => b[1].incl - a[1].incl).map(([cat, v]) =>
      [cat, v.count, zar(v.incl), zar(vatFromInclusive(v.incl)), zar(v.incl - vatFromInclusive(v.incl))] as (string | number)[]),
  ]
  const totalIncl = [...map.values()].reduce((s, v) => s + v.incl, 0)
  lines.push(['TOTAL', purch.length, zar(totalIncl), zar(vatFromInclusive(totalIncl)), zar(totalIncl - vatFromInclusive(totalIncl))])
  return lines.map(row).join('\n')
}

/** Income by customer/source — invoices, billed, paid, outstanding. */
export function buildIncomeBySource(
  invoices: ExportInvoice[],
  period: { from?: string; to?: string } = {},
): string {
  const sales = invoices.filter(i => inWindow(i.created_at, period.from, period.to))
  const map = new Map<string, { count: number; billed: number; paid: number }>()
  for (const i of sales) {
    const k = i.contact_name || 'Unknown'
    const cur = map.get(k) ?? { count: 0, billed: 0, paid: 0 }
    cur.count++; cur.billed += Number(i.amount || 0); cur.paid += Number(i.amount_paid || 0)
    map.set(k, cur)
  }
  const lines: (string | number)[][] = [
    ['Customer', 'Invoices', 'Billed (incl VAT)', 'Paid', 'Outstanding'],
    ...[...map.entries()].sort((a, b) => b[1].billed - a[1].billed).map(([name, v]) =>
      [name, v.count, zar(v.billed), zar(v.paid), zar(v.billed - v.paid)] as (string | number)[]),
  ]
  const t = [...map.values()].reduce((s, v) => ({ c: s.c + v.count, b: s.b + v.billed, p: s.p + v.paid }), { c: 0, b: 0, p: 0 })
  lines.push(['TOTAL', t.c, zar(t.b), zar(t.p), zar(t.b - t.p)])
  return lines.map(row).join('\n')
}

/** Accounts-receivable aging — outstanding balances bucketed by days overdue. */
export function buildArAging(invoices: ExportInvoice[], asOf: Date = new Date()): string {
  const buckets = ['Current', '1–30', '31–60', '61–90', '90+']
  const lines: (string | number)[][] = [['Customer', 'Outstanding', ...buckets]]
  const totals = [0, 0, 0, 0, 0]
  let grand = 0
  const open = invoices.filter(i => i.status !== 'paid' && i.status !== 'cancelled')
  for (const i of open) {
    const outstanding = Number(i.amount || 0) - Number(i.amount_paid || 0)
    if (outstanding <= 0) continue
    const due = i.due_date ? new Date(i.due_date) : new Date(i.created_at)
    const days = Math.floor((asOf.getTime() - due.getTime()) / 86_400_000)
    const b = days <= 0 ? 0 : days <= 30 ? 1 : days <= 60 ? 2 : days <= 90 ? 3 : 4
    const cells = [0, 0, 0, 0, 0]; cells[b] = outstanding; totals[b] += outstanding; grand += outstanding
    lines.push([i.contact_name || 'Unknown', zar(outstanding), ...cells.map(zar)])
  }
  lines.push(['TOTAL', zar(grand), ...totals.map(zar)])
  return lines.map(row).join('\n')
}
