import test from 'node:test'
import assert from 'node:assert/strict'
import { easterSunday, saPublicHolidays, workingDaysBetween, saToday, daysBetween } from '../lib/people/workingDays.ts'

test('easter: known dates', () => {
  assert.equal(easterSunday(2025), '2025-04-20')
  assert.equal(easterSunday(2026), '2026-04-05')
  assert.equal(easterSunday(2027), '2027-03-28')
})

test('holidays: 2026 has Good Friday, Family Day and the Women\'s Day Monday', () => {
  const h = saPublicHolidays(2026)
  assert.ok(h.has('2026-04-03'))   // Good Friday
  assert.ok(h.has('2026-04-06'))   // Family Day
  assert.ok(h.has('2026-08-09'))   // Sunday…
  assert.ok(h.has('2026-08-10'))   // …so Monday is off
  assert.ok(!h.has('2026-03-23'))  // 21 March 2026 is a Saturday: no Monday
})

test('holidays: Christmas on a Sunday gives no extra day beyond Day of Goodwill', () => {
  const h = saPublicHolidays(2022)
  assert.ok(h.has('2022-12-26'))
  assert.ok(!h.has('2022-12-27'))  // 2022's 27th was a once-off declaration → `extra`
})

test('working days: a weekend inside the range costs no leave', () => {
  assert.equal(workingDaysBetween('2026-10-09', '2026-10-13'), 3)   // Fri → Tue
  assert.equal(workingDaysBetween('2026-10-10', '2026-10-11'), 0)   // Sat–Sun
  assert.equal(workingDaysBetween('2026-10-12', '2026-10-12'), 1)
})

test('working days: public holidays inside the range cost no leave', () => {
  assert.equal(workingDaysBetween('2026-04-02', '2026-04-07'), 2)   // Easter weekend
  assert.equal(workingDaysBetween('2026-08-07', '2026-08-11'), 2)   // Women's Day Monday
  assert.equal(workingDaysBetween('2026-12-24', '2027-01-04'), 6)   // 24, 28–31 Dec, 4 Jan (25 Dec + 1 Jan off)
})

test('working days: six-day weeks and declared holidays', () => {
  assert.equal(workingDaysBetween('2026-10-09', '2026-10-13', { workDays: [1, 2, 3, 4, 5, 6] }), 4)
  assert.equal(workingDaysBetween('2026-10-12', '2026-10-13', { extra: ['2026-10-13'] }), 1)
})

test('working days: rejects reversed, malformed and year-plus ranges', () => {
  assert.throws(() => workingDaysBetween('2026-10-13', '2026-10-09'))
  assert.throws(() => workingDaysBetween('2026-02-30', '2026-03-02'))
  assert.throws(() => workingDaysBetween('2026-1-1', '2026-01-02'))
  assert.throws(() => workingDaysBetween('2026-01-01', '2027-06-01'))
})

test('saToday: 23:30 UTC is already tomorrow in SAST', () => {
  assert.equal(saToday(new Date('2026-10-05T23:30:00Z')), '2026-10-06')
  assert.equal(saToday(new Date('2026-10-05T21:59:00Z')), '2026-10-05')
  assert.equal(daysBetween('2026-10-01', '2026-10-05'), 4)
})
