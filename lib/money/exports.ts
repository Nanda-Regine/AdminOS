/**
 * Accountant-ready exports — the "operational finance brain that EXPORTS clean
 * coded working papers, it is not the system of record" pattern (from
 * BB-MotherShip-Deluxe `lib/finance/exports.ts`).
 *
 * Pure string builders — no DB, unit-testable (relative import on purpose:
 * tests load this file directly). SA VAT = 15%. Every output is a WORKING
 * PAPER for the bookkeeper to confirm, not a filed return.
 *
 * Sales VAT is the VAT actually recorded on each invoice (vat_amount). Only
 * legacy rows without that column fall back to treating the amount as
 * VAT-inclusive. Expense claims carry no VAT data, so input VAT is still an
 * inclusive-15% estimate and is labelled as one.
 *
 * Fixed 2026-10-05: the VAT201 paper counted draft and CANCELLED invoices as
 * sales, assumed 15% VAT on invoices raised without VAT, and claimed input
 * VAT on PENDING expense claims. The P&L and income reports had the same
 * draft/cancelled leak; AR aging counted drafts as receivables.
 */

import { labelFor, codeFor, isValidKey } from '../finance/chartOfAccounts.ts'
import { sastDate } from '../time/sast.ts'

export const VAT_RATE = 0.15

export interface ExportInvoice { contact_name: string | null; amount: number; amount_paid: number; status: string; created_at: string; due_date?: string | null; category?: string | null; vat_amount?: number | null }
export interface ExportExpense { category: string | null; description: string | null; amount: number; created_at: string; status: string }

const vatFromInclusive = (incl: number) => (incl * VAT_RATE) / (1 + VAT_RATE)
const zar = (n: number) => n.toFixed(2)
/**
 * CSV cell, safe to open in Excel. A text value starting with = + - @ (or a tab /
 * CR) is run as a formula — a contact named "=HYPERLINK(...)" arriving over
 * WhatsApp would execute on the accountant's machine. Such text is prefixed
 * with ' (numbers, including negatives, are left alone).
 */
export const csvCell = (v: string | number) => {
  let s = String(v ?? '')
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
/** Issued = a real sale: not a draft, not cancelled. */
const issued = (i: ExportInvoice) => i.status !== 'draft' && i.status !== 'cancelled'
/** Approved or paid — a pending claim isn't an expense yet, a rejected one never is. */
const booked = (e: ExportExpense) => e.status === 'approved' || e.status === 'paid'
/** VAT on one invoice: as recorded; legacy rows without vat_amount fall back to inclusive-15%. */
export const invoiceVat = (i: ExportInvoice) =>
  i.vat_amount == null ? vatFromInclusive(Number(i.amount || 0)) : Number(i.vat_amount)
const row = (cells: (string | number)[]) => cells.map(csvCell).join(',')
/**
 * Is a UTC timestamp inside [from, to], both SAST calendar dates (YYYY-MM-DD,
 * inclusive)? It compared the raw UTC string against the bounds, so a sale at
 * 01:00 SAST on the 1st (23:00 UTC the day before) landed in the previous
 * month's VAT201 and P&L.
 */
const inWindow = (iso: string, from?: string, to?: string) => {
  const day = sastDate(new Date(iso))
  return (!from || day >= from.slice(0, 10)) && (!to || day <= to.slice(0, 10))
}

/** VAT201 working paper: output VAT (sales) vs input VAT (purchases) → net payable. */
export function buildVat201WorkingPaper(
  invoices: ExportInvoice[],
  expenses: ExportExpense[],
  period: { from?: string; to?: string; label?: string } = {},
): { csv: string; summary: { salesIncl: number; outputVat: number; purchasesIncl: number; inputVat: number; netPayable: number; noVatSales: number } } {
  const sales = invoices.filter(i => issued(i) && inWindow(i.created_at, period.from, period.to))
  const purch = expenses.filter(e => booked(e) && inWindow(e.created_at, period.from, period.to))

  // Block 1 is standard-rated sales only; invoices with no VAT are reported separately.
  const vatSales = sales.filter(i => invoiceVat(i) > 0)
  const salesIncl = vatSales.reduce((s, i) => s + Number(i.amount || 0), 0)
  const outputVat = vatSales.reduce((s, i) => s + invoiceVat(i), 0)
  const noVatSales = sales.filter(i => invoiceVat(i) <= 0).reduce((s, i) => s + Number(i.amount || 0), 0)
  const purchasesIncl = purch.reduce((s, e) => s + Number(e.amount || 0), 0)
  const inputVat = vatFromInclusive(purchasesIncl)
  const netPayable = outputVat - inputVat

  const lines = [
    ['AdminOS — VAT201 WORKING PAPER (estimate — confirm with your accountant)'],
    [`Period`, period.label ?? `${period.from ?? 'start'} to ${period.to ?? 'today'}`],
    [`VAT basis`, `Output VAT as charged on each invoice; input VAT estimated at ${(VAT_RATE * 100).toFixed(0)}% of approved claims (check each has a valid tax invoice)`],
    [],
    ['Field', 'Description', 'Amount (ZAR)'],
    ['Block 1', 'Standard-rated sales (incl. VAT)', zar(salesIncl)],
    ['Block 4', 'OUTPUT VAT on sales', zar(outputVat)],
    ['—', 'Sales with no VAT charged (zero-rated / exempt / pre-registration) — classify with your accountant', zar(noVatSales)],
    ['Block 14', 'Standard-rated purchases (incl. VAT)', zar(purchasesIncl)],
    ['Block 15', 'INPUT VAT on purchases', zar(inputVat)],
    [],
    ['NET VAT', netPayable >= 0 ? 'Payable to SARS' : 'Refund due', zar(Math.abs(netPayable))],
  ]
  const csv = lines.map(l => (l.length === 0 ? '' : row(l))).join('\n')
  return { csv, summary: { salesIncl, outputVat, purchasesIncl, inputVat, netPayable, noVatSales } }
}

/** General-journal CSV (Xero/Sage-importable-ish): Date, Ref, Description, Account, Debit, Credit. */
export function buildJournalCsv(
  invoices: ExportInvoice[],
  expenses: ExportExpense[],
  period: { from?: string; to?: string } = {},
): string {
  const header = ['Date', 'Reference', 'Description', 'Account', 'Debit', 'Credit']
  const lines: (string | number)[][] = [header]

  const sales = invoices.filter(i => issued(i) && inWindow(i.created_at, period.from, period.to))
  for (const i of sales) {
    const d = i.created_at.slice(0, 10)
    const gross = Number(i.amount || 0)
    const vat = invoiceVat(i)
    const net = gross - vat
    const ref = (i.contact_name || 'SALE').slice(0, 20)
    const incomeAcct = `${labelFor('income', i.category)} (${codeFor('income', i.category)})`
    // AR debit gross; revenue credit net; VAT output credit
    lines.push([d, ref, `Invoice — ${i.contact_name ?? 'customer'}`, 'Accounts Receivable (1100)', zar(gross), ''])
    lines.push([d, ref, 'Sales revenue', incomeAcct, '', zar(net)])
    if (vat > 0) lines.push([d, ref, 'Output VAT', 'VAT Control (2200)', '', zar(vat)])
  }

  const purch = expenses.filter(e => booked(e) && inWindow(e.created_at, period.from, period.to))
  for (const e of purch) {
    const d = e.created_at.slice(0, 10)
    const gross = Number(e.amount || 0)
    const vat = vatFromInclusive(gross)
    const net = gross - vat
    const acct = `${labelFor('expense', e.category)} (${codeFor('expense', e.category)})`
    lines.push([d, 'EXP', e.description || acct, acct, zar(net), ''])
    lines.push([d, 'EXP', 'Input VAT', 'VAT Control (2200)', zar(vat), ''])
    lines.push([d, 'EXP', 'Payable', 'Accounts Payable (2100)', '', zar(gross)])
  }

  return lines.map(row).join('\n')
}

// ── Monthly accountant pack (task #13) — each a clean, categorised working paper ──
// Prefers the real chart-of-accounts label (lib/finance/chartOfAccounts.ts);
// falls back to title-casing whatever's actually stored so pre-chart-of-
// accounts rows (or any free-text category) still read cleanly.
const humanCat = (c: string | null, kind: 'income' | 'expense' = 'expense') => {
  if (!c) return 'Uncategorised'
  if (isValidKey(kind, c)) return labelFor(kind, c)
  return c.replace(/[_-]/g, ' ').replace(/\b\w/g, ch => ch.toUpperCase())
}

/** Income Statement (P&L): revenue by category (net of VAT), expenses by category (net), net profit. */
export function buildIncomeStatement(
  invoices: ExportInvoice[],
  expenses: ExportExpense[],
  period: { from?: string; to?: string; label?: string } = {},
): string {
  const sales = invoices.filter(i => issued(i) && inWindow(i.created_at, period.from, period.to))
  const purch = expenses.filter(e => booked(e) && inWindow(e.created_at, period.from, period.to))

  const revByCat = new Map<string, number>()
  for (const i of sales) {
    const g = Number(i.amount || 0)
    const k = humanCat(i.category ?? 'sales', 'income')
    revByCat.set(k, (revByCat.get(k) || 0) + (g - invoiceVat(i)))
  }
  const revenueNet = [...revByCat.values()].reduce((a, b) => a + b, 0)

  const byCat = new Map<string, number>()
  for (const e of purch) {
    const g = Number(e.amount || 0)
    const k = humanCat(e.category)
    byCat.set(k, (byCat.get(k) || 0) + (g - vatFromInclusive(g)))
  }
  const totalExpNet = [...byCat.values()].reduce((a, b) => a + b, 0)
  const netProfit = revenueNet - totalExpNet

  const lines: (string | number)[][] = [
    ['AdminOS — INCOME STATEMENT (Profit & Loss) — working paper'],
    ['Period', period.label ?? `${period.from ?? 'start'} to ${period.to ?? 'today'}`],
    ['Basis', 'Net of VAT: sales by the VAT on each invoice; expenses estimated at 15% inclusive. Drafts, cancelled invoices and pending claims excluded.'],
    [],
    ['REVENUE', 'Amount (ZAR)'],
    ...[...revByCat.entries()].sort((a, b) => b[1] - a[1]).map(([cat, amt]) => [cat, zar(amt)] as (string | number)[]),
    ['Total revenue', zar(revenueNet)],
    [],
    ['EXPENSES', 'Amount (ZAR)'],
    ...[...byCat.entries()].sort((a, b) => b[1] - a[1]).map(([cat, amt]) => [cat, zar(amt)] as (string | number)[]),
    ['Total expenses', zar(totalExpNet)],
    [],
    ['NET PROFIT / (LOSS)', zar(netProfit)],
  ]
  return lines.map(l => (l.length === 0 ? '' : row(l))).join('\n')
}

/** Revenue grouped by income category — count, VAT-inclusive total, VAT, net. */
export function buildIncomeByCategory(
  invoices: ExportInvoice[],
  period: { from?: string; to?: string } = {},
): string {
  const sales = invoices.filter(i => issued(i) && inWindow(i.created_at, period.from, period.to))
  const map = new Map<string, { count: number; incl: number; vat: number }>()
  for (const i of sales) {
    const k = humanCat(i.category ?? 'sales', 'income')
    const cur = map.get(k) ?? { count: 0, incl: 0, vat: 0 }
    cur.count++; cur.incl += Number(i.amount || 0); cur.vat += invoiceVat(i)
    map.set(k, cur)
  }
  const lines: (string | number)[][] = [
    ['Category', 'Count', 'Total (incl VAT)', 'VAT', 'Net'],
    ...[...map.entries()].sort((a, b) => b[1].incl - a[1].incl).map(([cat, v]) =>
      [cat, v.count, zar(v.incl), zar(v.vat), zar(v.incl - v.vat)] as (string | number)[]),
  ]
  const totalIncl = [...map.values()].reduce((s, v) => s + v.incl, 0)
  const totalVat = [...map.values()].reduce((s, v) => s + v.vat, 0)
  lines.push(['TOTAL', sales.length, zar(totalIncl), zar(totalVat), zar(totalIncl - totalVat)])
  return lines.map(row).join('\n')
}

/** Expenses grouped by category — count, VAT-inclusive total, VAT, net. */
export function buildExpensesByCategory(
  expenses: ExportExpense[],
  period: { from?: string; to?: string } = {},
): string {
  const purch = expenses.filter(e => booked(e) && inWindow(e.created_at, period.from, period.to))
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
  const sales = invoices.filter(i => issued(i) && inWindow(i.created_at, period.from, period.to))
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
  const open = invoices.filter(i => issued(i) && i.status !== 'paid')
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
