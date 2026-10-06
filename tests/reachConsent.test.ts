import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mayMarketTo, isOptOutReply, withOptOutFooter, OPT_OUT_INSTRUCTION, dedupeByPhone, personalise } from '../lib/reach/consent.ts'
import { phoneDigits } from '../lib/contacts/phone.ts'

const c = (o: Partial<Parameters<typeof mayMarketTo>[0]>) =>
  ({ phone: '+27823456789', contact_type: 'unknown', popia_consent: false, marketing_opt_out_at: null, ...o })

test('s69(1): consent OR existing customer; never after an objection', () => {
  assert.ok(mayMarketTo(c({ popia_consent: true })))
  assert.ok(mayMarketTo(c({ contact_type: 'client' })))
  assert.ok(!mayMarketTo(c({})), 'unknown with no consent')
  assert.ok(!mayMarketTo(c({ contact_type: 'supplier' })))
  assert.ok(!mayMarketTo(c({ contact_type: 'client', marketing_opt_out_at: '2026-10-01T00:00:00Z' })), 'customer who said STOP')
  assert.ok(!mayMarketTo(c({ popia_consent: true, marketing_opt_out_at: '2026-10-01T00:00:00Z' })), 'consent then STOP')
  assert.ok(!mayMarketTo(c({ popia_consent: true, phone: '  ' })))
})

test('STOP replies are recognised; ordinary messages are not', () => {
  for (const t of ['STOP', 'stop', ' Stop. ', 'unsubscribe', 'Opt out', 'opt-out', 'stop please']) assert.ok(isOptOutReply(t), t)
  for (const t of ["Don't stop the booking", 'Can I stop by at 3?', 'stopwatch', '', null]) assert.ok(!isOptOutReply(t), String(t))
})

test('s69(4): every message names the sender and how to stop; idempotent', () => {
  const m = withOptOutFooter('Specials this week!', 'Lindiwe Hair Studio')
  assert.ok(m.startsWith('Specials this week!'))
  assert.ok(m.includes('Lindiwe Hair Studio'))
  assert.ok(m.endsWith(OPT_OUT_INSTRUCTION))
  assert.equal(withOptOutFooter(m, 'Lindiwe Hair Studio'), m)
  assert.ok(withOptOutFooter('Hi', null).endsWith(OPT_OUT_INSTRUCTION))
})

test('one person stored twice is messaged once', () => {
  const rows = [{ id: 'a', phone: '+27 82 345 6789' }, { id: 'b', phone: '0823456789' }, { id: 'c', phone: '0711111111' }, { id: 'd', phone: null }]
  assert.deepEqual(dedupeByPhone(rows, phoneDigits).map((r) => r.id), ['a', 'c'])
})

test('{{name}} becomes the first name', () => {
  assert.equal(personalise('Hi {{name}}!', 'Thandi Mokoena'), 'Hi Thandi!')
  assert.equal(personalise('Hi {{ NAME }}', null), 'Hi there')
  assert.equal(personalise('No tag', 'X'), 'No tag')
})
