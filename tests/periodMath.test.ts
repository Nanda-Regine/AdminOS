import test from 'node:test'
import assert from 'node:assert/strict'
import { periodBoundsUTC, payrollCostInRange, valuationSector } from '../lib/intelligence/periodMath.ts'

test('period end is inclusive: the last SAST day is inside the range', () => {
  const b = periodBoundsUTC('2026-09-01', '2026-09-30')
  assert.equal(b.start, '2026-08-31T22:00:00.000Z')
  assert.equal(b.endExclusive, '2026-09-30T22:00:00.000Z')
  // an invoice created 30 Sep 15:00 SAST is inside
  assert.ok('2026-09-30T13:00:00.000Z' < b.endExclusive)
})

const run = (m: number, y: number, status = 'paid') =>
  ({ period_month: m, period_year: y, status, total_gross: 10000, total_uif_employer: 100, total_sdl: 100 })

test('payroll cost counts finalised/paid runs in range at employer cost', () => {
  const runs = [run(9, 2026), run(8, 2026), run(9, 2026, 'draft'), run(10, 2026)]
  assert.equal(payrollCostInRange(runs, '2026-09-01', '2026-09-30'), 10200)
  assert.equal(payrollCostInRange(runs, '2026-08-15', '2026-10-31'), 30600)
})

test('business types map onto known sectors, unknown fall through', () => {
  assert.equal(valuationSector('clinic'), 'healthcare')
  assert.equal(valuationSector('retail'), 'retail')
  assert.equal(valuationSector(null), '')
})
