import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildWatchouts } from '../lib/brief/watchouts.ts'

const today = '2026-11-02' // a Monday
const late = { n: 4, medianDaysLate: 9, lateRate: 0.75 }
const prompt = { n: 4, medianDaysLate: 0, lateRate: 0.1 }

test('nothing to warn about → empty', () => {
  assert.deepEqual(buildWatchouts({ today, forecast: null, openInvoices: [] }), [])
})

test('ranked by rands at stake, capped at three', () => {
  const w = buildWatchouts({
    today,
    forecast: {
      lowestPoint: -40_000,
      lowestPointDate: '2026-11-20',
      outflows: [
        { date: '2026-11-05', amount: 90_000, probability: 1, source: 'payroll', label: 'Payroll (net pay)' },
        { date: '2026-11-06', amount: 12_000, probability: 1, source: 'tax', label: 'EMP201' },
      ],
    },
    openInvoices: [{ id: 'i1', contact: 'Thandi', outstanding: 5_000, dueDate: '2026-10-20', habit: null }],
  })
  assert.equal(w.length, 3)
  assert.deepEqual(w.map((x) => x.kind), ['payroll', 'cash_gap', 'tax'])
  assert.ok(w.every((x) => x.href.startsWith('/dashboard/')))
})

test('the cash gap is worded as money out vs in, never as a bank balance', () => {
  const [w] = buildWatchouts({ today, forecast: { lowestPoint: -1500, lowestPointDate: '2026-11-10', outflows: [] }, openInvoices: [] })
  assert.match(w.title, /outrun money in/)
  assert.doesNotMatch(w.title, /balance/i)
})

test('a gap far in the future (or a positive low point) is not "this week" news', () => {
  assert.equal(buildWatchouts({ today, forecast: { lowestPoint: -9000, lowestPointDate: '2027-01-30', outflows: [] }, openInvoices: [] }).length, 0)
  assert.equal(buildWatchouts({ today, forecast: { lowestPoint: 500, lowestPointDate: '2026-11-10', outflows: [] }, openInvoices: [] }).length, 0)
})

test('payroll and tax outside the next 7 days are left out', () => {
  const w = buildWatchouts({
    today,
    forecast: { lowestPoint: 0, lowestPointDate: today, outflows: [{ date: '2026-11-25', amount: 50_000, probability: 1, source: 'payroll', label: 'Payroll' }] },
    openInvoices: [],
  })
  assert.equal(w.length, 0)
})

test('a usually-late payer due this week is flagged; a prompt payer is not', () => {
  const w = buildWatchouts({
    today,
    forecast: null,
    openInvoices: [
      { id: 'a', contact: 'Slow Co', outstanding: 8_000, dueDate: '2026-11-06', habit: late },
      { id: 'b', contact: 'Prompt Co', outstanding: 9_000, dueDate: '2026-11-06', habit: prompt },
      { id: 'c', contact: 'New Co', outstanding: 7_000, dueDate: '2026-11-06', habit: null },
    ],
  })
  assert.equal(w.length, 1)
  assert.equal(w[0].kind, 'late_payer')
  assert.match(w[0].title, /Slow Co/)
  assert.match(w[0].detail, /9 days late/)
})

test('overdue invoices roll up into one item with the largest named', () => {
  const [w] = buildWatchouts({
    today,
    forecast: null,
    openInvoices: [
      { id: 'a', contact: 'Small', outstanding: 1_000, dueDate: '2026-10-30', habit: null },
      { id: 'b', contact: 'Big', outstanding: 6_000, dueDate: '2026-10-12', habit: null },
      { id: 'c', contact: 'Fine', outstanding: 3_000, dueDate: '2026-11-20', habit: null },
    ],
  })
  assert.equal(w.kind, 'overdue')
  assert.equal(w.amount, 7_000)
  assert.match(w.detail, /Big/)
  assert.match(w.detail, /21 days overdue/)
})

test('fully paid invoices (nothing outstanding) never count as overdue', () => {
  assert.equal(buildWatchouts({ today, forecast: null, openInvoices: [{ id: 'a', contact: 'X', outstanding: 0, dueDate: '2026-10-01', habit: null }] }).length, 0)
})
