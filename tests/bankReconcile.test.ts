import test from 'node:test'
import assert from 'node:assert/strict'
import { suggestMatches, type CreditLine, type OpenInvoice } from '../lib/bank/reconcile.ts'

const inv = (id: string, reference: string, contact: string, amount: number, paid = 0): OpenInvoice =>
  ({ id, reference, contact_name: contact, amount, amount_paid: paid })
const line = (id: string, description: string, amount: number): CreditLine => ({ id, description, amount })

const INVOICES = [
  inv('i1', 'INV-20260518-1009', 'Riaan Pretorius', 5560),
  inv('i2', 'INV-20260602-1005', 'Nomvula Sithole', 1668),
  inv('i3', 'INV-20260610-1006', 'Themba Nkosi', 7935, 2777),
]

test('invoice number + exact amount is a high-confidence match', () => {
  const [s] = suggestMatches([line('t1', 'FNB App Rtc Credit Riaan Pretorius INV-20260518-1009', 5560)], INVOICES)
  assert.equal(s.invoiceId, 'i1')
  assert.equal(s.confidence, 'high')
  assert.equal(s.partial, false)
})

test('exact amount + payer name (no reference) is a match, medium or better', () => {
  const [s] = suggestMatches([line('t1', 'Payment Received N SITHOLE', 1668)], INVOICES)
  assert.equal(s.invoiceId, 'i2')
  assert.ok(s.reasons.includes('Payer name in reference'))
})

test('amount alone with no name or number is not suggested', () => {
  assert.deepEqual(suggestMatches([line('t1', 'Cash deposit', 1668)], INVOICES), [])
})

test('the amount owed is what counts, not the invoice total', () => {
  // i3 total 7935, 2777 already paid → 5158 owed.
  const [s] = suggestMatches([line('t1', 'EFT Themba Nkosi INV-20260610-1006', 5158)], INVOICES)
  assert.equal(s.invoiceId, 'i3')
  assert.equal(s.confidence, 'high')
})

test('a part-payment is flagged and never high confidence', () => {
  const [s] = suggestMatches([line('t1', 'EFT Themba Nkosi INV-20260610-1006', 1000)], INVOICES)
  assert.equal(s.partial, true)
  assert.equal(s.confidence, 'medium')
})

test('more than is owed is never matched (overpayment needs a human)', () => {
  assert.deepEqual(suggestMatches([line('t1', 'EFT Riaan Pretorius INV-20260518-1009', 6000)], INVOICES), [])
})

test('two equal-scoring invoices are reported ambiguous', () => {
  const twins = [inv('a', 'INV-1-0001', 'Sipho Dlamini', 500), inv('b', 'INV-1-0002', 'Sipho Dlamini', 500)]
  const [s] = suggestMatches([line('t1', 'Payment Sipho Dlamini', 500)], twins)
  assert.equal(s.ambiguous, true)
  assert.equal(s.confidence, 'medium')
})

test('one invoice is offered to only one bank line', () => {
  const out = suggestMatches(
    [line('t1', 'Riaan Pretorius INV-20260518-1009', 5560), line('t2', 'Riaan Pretorius', 5560)],
    [INVOICES[0]],
  )
  assert.equal(out.length, 1)
  assert.equal(out[0].transactionId, 't1')
})

test('debits, zero amounts and settled invoices are ignored', () => {
  assert.deepEqual(suggestMatches([line('t1', 'Riaan Pretorius', -5560), line('t2', 'Riaan Pretorius', 0)], INVOICES), [])
  assert.deepEqual(suggestMatches([line('t1', 'Riaan Pretorius INV-20260518-1009', 5560)], [inv('i1', 'INV-20260518-1009', 'Riaan Pretorius', 5560, 5560)]), [])
})

test('cent arithmetic does not drift (0.1 + 0.2 style)', () => {
  const [s] = suggestMatches([line('t1', 'Jane Doe INV-9-0001', 100.3)], [inv('x', 'INV-9-0001', 'Jane Doe', 100.3)])
  assert.equal(s.confidence, 'high')
})
