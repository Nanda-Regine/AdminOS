import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildVat201WorkingPaper, buildArAging, buildIncomeStatement, csvCell, type ExportInvoice, type ExportExpense } from '../lib/money/exports.ts'

const inv = (o: Partial<ExportInvoice>): ExportInvoice => ({
  contact_name: 'Acme', amount: 0, amount_paid: 0, status: 'sent', created_at: '2026-09-10T10:00:00Z', ...o,
})
const exp = (o: Partial<ExportExpense>): ExportExpense => ({
  category: 'travel', description: null, amount: 0, created_at: '2026-09-12T10:00:00Z', status: 'approved', ...o,
})
const SEPT = { from: '2026-09-01', to: '2026-09-30T23:59:59' }

test('VAT201: cancelled and draft invoices are not sales', () => {
  const { summary } = buildVat201WorkingPaper([
    inv({ amount: 1150, vat_amount: 150 }),
    inv({ amount: 1150, vat_amount: 150, status: 'cancelled' }),
    inv({ amount: 1150, vat_amount: 150, status: 'draft' }),
  ], [], SEPT)
  assert.equal(summary.salesIncl, 1150)
  assert.equal(summary.outputVat, 150)
})

test('VAT201: an invoice raised without VAT adds no output VAT', () => {
  const { summary } = buildVat201WorkingPaper([
    inv({ amount: 1000, vat_amount: 0 }),
    inv({ amount: 1150, vat_amount: 150 }),
  ], [], SEPT)
  assert.equal(summary.outputVat, 150)
  assert.equal(summary.noVatSales, 1000)
})

test('VAT201: legacy rows without vat_amount fall back to inclusive 15%', () => {
  const { summary } = buildVat201WorkingPaper([inv({ amount: 1150 })], [], SEPT)
  assert.equal(Math.round(summary.outputVat * 100) / 100, 150)
})

test('VAT201: input VAT only on approved/paid claims, never pending or rejected', () => {
  const { summary } = buildVat201WorkingPaper([], [
    exp({ amount: 115, status: 'approved' }),
    exp({ amount: 115, status: 'paid' }),
    exp({ amount: 115, status: 'pending' }),
    exp({ amount: 115, status: 'rejected' }),
  ], SEPT)
  assert.equal(summary.purchasesIncl, 230)
})

test('AR aging ignores drafts, cancelled and paid', () => {
  const csv = buildArAging([
    inv({ amount: 500, status: 'draft' }),
    inv({ amount: 500, status: 'cancelled' }),
    inv({ amount: 500, amount_paid: 500, status: 'paid' }),
    inv({ amount: 500, amount_paid: 200, status: 'partial', due_date: '2026-09-01' }),
  ], new Date('2026-10-05'))
  assert.match(csv, /TOTAL,300\.00/)
})

test('income statement excludes cancelled sales', () => {
  const csv = buildIncomeStatement([
    inv({ amount: 1000, vat_amount: 0, category: 'sales' }),
    inv({ amount: 9999, vat_amount: 0, status: 'cancelled' }),
  ], [], SEPT)
  assert.match(csv, /Total revenue,1000\.00/)
})

test('csvCell neutralises formulas in text but leaves numbers alone', () => {
  assert.equal(csvCell('=HYPERLINK("http://x","y")'), `"'=HYPERLINK(""http://x"",""y"")"`)
  assert.equal(csvCell('@SUM(A1)'), `'@SUM(A1)`)
  assert.equal(csvCell('-500.00'), '-500.00')
  assert.equal(csvCell(-12), '-12')
  assert.equal(csvCell('Acme, Ltd'), '"Acme, Ltd"')
})
