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
