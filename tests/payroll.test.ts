import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  TAX_TABLES, taxYearFor, taxTableFor, calculateAnnualPAYE, calculatePayroll, generateEMP201,
} from '../lib/payroll/calculate.ts'

test('tax year: March starts the next year label', () => {
  assert.equal(taxYearFor(2, 2026), 2026)   // Feb 2026 → 2025/26
  assert.equal(taxYearFor(3, 2026), 2027)   // Mar 2026 → 2026/27
  assert.equal(taxYearFor(10, 2026), 2027)
})

test('tables: back-dated periods use their own year; future falls forward to latest', () => {
  assert.equal(taxTableFor(1, 2026).year, 2026)
  assert.equal(taxTableFor(10, 2026).year, 2027)
  assert.equal(taxTableFor(10, 2030).year, 2027)
})

test('brackets: each base equals tax on the bracket below (tables are self-consistent)', () => {
  for (const [year, t] of Object.entries(TAX_TABLES)) {
    for (let i = 1; i < t.brackets.length; i++) {
      const prev = t.brackets[i - 1], cur = t.brackets[i]
      const expected = prev.base + (cur.over - prev.over) * prev.rate
      assert.ok(Math.abs(expected - cur.base) < 1, `${year} bracket ${i}: ${expected} vs ${cur.base}`)
    }
  }
})

test('2026/27 tax threshold is R99,000 (below it no PAYE)', () => {
  const t = TAX_TABLES[2027]
  assert.equal(calculateAnnualPAYE(99_000, 30, t), 0)
  assert.ok(calculateAnnualPAYE(100_000, 30, t) > 0)
})

test('2026/27 PAYE on R300,000/yr = 44,118 + 26% × 54,900 − 17,820', () => {
  const tax = calculateAnnualPAYE(300_000, 30, TAX_TABLES[2027])
  assert.equal(Math.round(tax * 100) / 100, 44_118 + 0.26 * 54_900 - 17_820)
})

test('calculatePayroll picks the period table: Oct 2026 pays less PAYE than the stale 2025/26 table', () => {
  const now = calculatePayroll({ grossMonthly: 25_000, periodMonth: 10, periodYear: 2026 })
  const old = calculatePayroll({ grossMonthly: 25_000, periodMonth: 1, periodYear: 2026 })
  assert.ok(now.paye < old.paye, `${now.paye} < ${old.paye}`)
  assert.equal(now.uifEmployee, 177.12)   // capped at R17,712
})

test('EMP201 from payslip rows (snake_case, string numerics) is never NaN', () => {
  const rows = [
    { paye: '1000.50', uif_employee: '177.12', uif_employer: '177.12', sdl: '0' },
    { paye: 0, uif_employee: 100, uif_employer: 100, sdl: null },
  ]
  const e = generateEMP201(rows, 10, 2026)
  assert.equal(e.totalUIF, 554.24)
  assert.equal(e.totalLiability, 1554.74)
  assert.equal(e.employeeCount, 2)
})
