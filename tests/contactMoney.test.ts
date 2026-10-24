import test from 'node:test'
import assert from 'node:assert/strict'
import { phoneKey, summariseContactMoney, type MoneyInvoice } from '../lib/contacts/money.ts'

const inv = (o: Partial<MoneyInvoice>): MoneyInvoice =>
  ({ contact_id: null, contact_phone: null, amount: 0, amount_paid: 0, status: 'sent', ...o })

const A = { id: 'a', phone: '+27 82 123 4501' }
const B = { id: 'b', phone: '+27 83 123 4502' }

test('invoiced, paid and owed come from the invoices, per contact', () => {
  const m = summariseContactMoney([
    inv({ contact_id: 'a', amount: 1000, amount_paid: 1000, status: 'paid' }),
    inv({ contact_id: 'a', amount: 2000, amount_paid: 500, status: 'partial' }),
    inv({ contact_id: 'b', amount: 300, amount_paid: 0, status: 'overdue' }),
  ], [A, B])
  assert.deepEqual(m.get('a'), { invoiced: 3000, paid: 1500, owed: 1500 })
  assert.deepEqual(m.get('b'), { invoiced: 300, paid: 0, owed: 300 })
})

test('drafts and cancelled invoices never count', () => {
  const m = summariseContactMoney([
    inv({ contact_id: 'a', amount: 999, status: 'draft' }),
    inv({ contact_id: 'a', amount: 888, status: 'cancelled' }),
    inv({ contact_id: 'a', amount: 100, status: 'sent' }),
  ], [A])
  assert.deepEqual(m.get('a'), { invoiced: 100, paid: 0, owed: 100 })
})

test('debt handed to collections is still owed; a paid invoice owes nothing', () => {
  const m = summariseContactMoney([
    inv({ contact_id: 'a', amount: 5560.25, status: 'in_collections' }),
    inv({ contact_id: 'a', amount: 400, amount_paid: 400, status: 'paid' }),
  ], [A])
  assert.deepEqual(m.get('a'), { invoiced: 5960.25, paid: 400, owed: 5560.25 })
})

test('the stored-value lie: paid is what was paid, not a seeded number', () => {
  // Themba on the live demo tenant: stored total_paid said 6440, invoices say 2777.25.
  const m = summariseContactMoney([inv({ contact_id: 'a', amount: 7935, amount_paid: 2777.25, status: 'partial' })], [A])
  assert.equal(m.get('a')!.paid, 2777.25)
  assert.equal(m.get('a')!.owed, 5157.75)
})

test('contact_id wins over phone; phone is only a fallback when there is no contact_id', () => {
  const m = summariseContactMoney([
    inv({ contact_id: 'b', contact_phone: '+27 82 123 4501', amount: 100 }), // belongs to B despite A's phone
    inv({ contact_id: null, contact_phone: '0821234501', amount: 50 }),      // no id -> A via phone (0xx format)
  ], [A, B])
  assert.equal(m.get('a')!.invoiced, 50)
  assert.equal(m.get('b')!.invoiced, 100)
})

test('an ambiguous phone (two contacts share it) attributes nobody; blank phone never matches', () => {
  const twin = { id: 'c', phone: '082 123 4501' }
  const m = summariseContactMoney([
    inv({ contact_id: null, contact_phone: '+27821234501', amount: 70 }),
    inv({ contact_id: null, contact_phone: '', amount: 30 }),
    inv({ contact_id: null, contact_phone: null, amount: 20 }),
  ], [A, twin, { id: 'd', phone: '' }])
  for (const id of ['a', 'c', 'd']) assert.equal(m.get(id)!.invoiced, 0, id)
})

test('a contact with no invoices is present with zeros', () => {
  assert.deepEqual(summariseContactMoney([], [A]).get('a'), { invoiced: 0, paid: 0, owed: 0 })
})

test('an invoice pointing at an unknown contact_id is ignored, not misattributed by phone', () => {
  const m = summariseContactMoney([inv({ contact_id: 'zzz', contact_phone: '+27 82 123 4501', amount: 10 })], [A])
  assert.equal(m.get('a')!.invoiced, 0)
})

test('cents do not drift', () => {
  const m = summariseContactMoney([
    inv({ contact_id: 'a', amount: 0.1 }), inv({ contact_id: 'a', amount: 0.2 }),
  ], [A])
  assert.equal(m.get('a')!.invoiced, 0.3)
})

test('phoneKey normalises SA formats and refuses short numbers', () => {
  assert.equal(phoneKey('+27 82 123 4501'), phoneKey('0821234501'))
  assert.equal(phoneKey('27821234501'), '821234501')
  assert.equal(phoneKey('12345'), '')
  assert.equal(phoneKey(null), '')
})
