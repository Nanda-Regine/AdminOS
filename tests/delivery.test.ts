import test from 'node:test'
import assert from 'node:assert/strict'
import { nowMinutesSAST, parseQuietHours, isQuietNow, channelEnabled, whatsappAllowed } from '../lib/notifications/delivery.ts'

// 08:00 UTC == 10:00 SAST
const at = (utcHour: number, utcMin = 0) => new Date(Date.UTC(2026, 6, 19, utcHour, utcMin))

test('nowMinutesSAST shifts UTC by +2h and wraps past midnight', () => {
  assert.equal(nowMinutesSAST(at(8, 0)), 10 * 60)   // 10:00 SAST
  assert.equal(nowMinutesSAST(at(23, 0)), 60)        // 01:00 SAST next day
})

test('parseQuietHours validates and rejects empty/invalid windows', () => {
  assert.deepEqual(parseQuietHours({ quiet_hours: { start: 1260, end: 360 } }), { start: 1260, end: 360 })
  assert.equal(parseQuietHours(null), null)
  assert.equal(parseQuietHours({}), null)
  assert.equal(parseQuietHours({ quiet_hours: { start: 300, end: 300 } }), null) // empty
  assert.equal(parseQuietHours({ quiet_hours: { start: 300 } }), null)           // missing end
  assert.equal(parseQuietHours({ quiet_hours: { start: -1, end: 60 } }), null)   // out of range
})

test('isQuietNow handles an overnight window (21:00 → 06:00 SAST)', () => {
  const s = { quiet_hours: { start: 21 * 60, end: 6 * 60 } }
  assert.equal(isQuietNow(s, at(21, 0)), true)   // 23:00 SAST — inside
  assert.equal(isQuietNow(s, at(3, 0)), true)    // 05:00 SAST — inside
  assert.equal(isQuietNow(s, at(8, 0)), false)   // 10:00 SAST — outside
  assert.equal(isQuietNow(s, at(4, 0)), false)   // 06:00 SAST — boundary is exclusive
})

test('no window configured is never quiet', () => {
  assert.equal(isQuietNow({}, at(2, 0)), false)
})

test('channelEnabled defaults to on and honours an explicit opt-out', () => {
  assert.equal(channelEnabled({}, 'payment.received', 'whatsapp'), true)
  assert.equal(channelEnabled({ notify: { 'payment.received': { whatsapp: false } } }, 'payment.received', 'whatsapp'), false)
  assert.equal(channelEnabled({ notify: { 'payment.received': { whatsapp: false } } }, 'approval.needed', 'whatsapp'), true)
})

test('whatsappAllowed combines preference and quiet hours', () => {
  const quiet = { quiet_hours: { start: 21 * 60, end: 6 * 60 } }
  assert.equal(whatsappAllowed({}, 'payment.received', at(8, 0)), true)            // on, awake
  assert.equal(whatsappAllowed(quiet, 'payment.received', at(3, 0)), false)        // quiet hours
  assert.equal(whatsappAllowed({ notify: { 'payment.received': { whatsapp: false } } }, 'payment.received', at(8, 0)), false) // opted out
})
