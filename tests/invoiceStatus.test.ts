import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  OPEN_INVOICE_STATUSES, OWED_INVOICE_STATUSES, isOpen, isOwed, outstanding, paymentState,
} from '../lib/invoices/status.ts'

test('invoices the app creates (status sent) are open and get chased', () => {
  assert.ok(isOpen('sent'))
  assert.ok((OPEN_INVOICE_STATUSES as readonly string[]).includes('sent'))
})

test('drafts, paid, cancelled are never open or owed', () => {
  for (const s of ['draft', 'paid', 'cancelled', null, undefined, '']) {
    assert.equal(isOpen(s), false, String(s))
    assert.equal(isOwed(s), false, String(s))
  }
})

test('in_collections is owed but not chased by AdminOS', () => {
  assert.equal(isOpen('in_collections'), false)
  assert.equal(isOwed('in_collections'), true)
  assert.ok((OWED_INVOICE_STATUSES as readonly string[]).includes('in_collections'))
})

test('outstanding is amount minus paid, floored at 0, tolerant of strings/nulls', () => {
  assert.equal(outstanding({ amount: 7935, amount_paid: 2777.25 }), 5157.75)
  assert.equal(outstanding({ amount: '100.00', amount_paid: '40' }), 60)
  assert.equal(outstanding({ amount: 100, amount_paid: null }), 100)
  assert.equal(outstanding({ amount: 100, amount_paid: 150 }), 0)
})

test('paymentState: full, partial, none', () => {
  assert.deepEqual(paymentState(1000, 1000), { status: 'paid', amount_paid: 1000, amount_due: 0 })
  assert.deepEqual(paymentState(1000, 250.5), { status: 'partial', amount_paid: 250.5, amount_due: 749.5 })
  assert.deepEqual(paymentState(1000, 0), { status: null, amount_paid: 0, amount_due: 1000 })
})

test('paymentState rounds amount_due to cents', () => {
  assert.equal(paymentState(1811.25, 1086.75).amount_due, 724.5)
  assert.equal(paymentState(0.3, 0.1).amount_due, 0.2)
})
