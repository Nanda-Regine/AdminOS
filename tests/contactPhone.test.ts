import { test } from 'node:test'
import assert from 'node:assert/strict'
import { phoneDigits, samePhone, toE164, phoneLikePattern } from '../lib/contacts/phone.ts'

test('one person, three channels: dashboard, booking form, WhatsApp', () => {
  assert.ok(samePhone('+27 82 345 6789', '0823456789'))
  assert.ok(samePhone('0823456789', '27823456789'))
  assert.ok(samePhone('+27 (82) 345-6789', '0027823456789'))
  assert.ok(!samePhone('0823456789', '0823456788'))
  assert.ok(!samePhone(null, null))
})

test('storage + lookup forms', () => {
  assert.equal(toE164('082 345 6789'), '+27823456789')
  assert.equal(phoneDigits('abc'), null)
  assert.equal(phoneLikePattern('0823456789'), '%8%2%3%4%5%6%7%8%9')
})
