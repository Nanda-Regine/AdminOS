import { test } from 'node:test'
import assert from 'node:assert/strict'
import { suggestQuantity, buildReorderLines, orderDraftText } from '../lib/ops/reorder.ts'

const item = (o: Partial<Parameters<typeof buildReorderLines>[0][number]> = {}) => ({
  name: 'Flour 12.5kg', unit: 'bag', onHand: 3, reorderLevel: 5, reorderQuantity: null, sold30: 0, costPrice: null, ...o,
})

test("the owner's own order size always wins", () => {
  assert.deepEqual(suggestQuantity({ onHand: 3, reorderLevel: 5, reorderQuantity: 24, sold30: 100 }), { qty: 24, basis: 'owner_quantity' })
})

test('no order size and no sales → lift stock to twice the reorder level', () => {
  assert.deepEqual(suggestQuantity({ onHand: 3, reorderLevel: 5, reorderQuantity: null, sold30: 0 }), { qty: 7, basis: 'restock_level' })
})

test('a fast mover is ordered at the size it actually sells', () => {
  assert.deepEqual(suggestQuantity({ onHand: 3, reorderLevel: 5, reorderQuantity: null, sold30: 40 }), { qty: 40, basis: 'recent_sales' })
})

test('never orders zero or a negative amount, even when stock is somehow above twice the level', () => {
  assert.equal(suggestQuantity({ onHand: 50, reorderLevel: 5, reorderQuantity: null, sold30: 0 }).qty, 1)
  assert.equal(suggestQuantity({ onHand: -2, reorderLevel: 5, reorderQuantity: null, sold30: -4 }).qty, 12)
})

test('lines are sorted and costed only when a cost price is known', () => {
  const lines = buildReorderLines([item({ name: 'Sugar', costPrice: 40, reorderQuantity: 10 }), item({ name: 'Flour' })])
  assert.deepEqual(lines.map((l) => l.name), ['Flour', 'Sugar'])
  assert.equal(lines[0].estCost, null)
  assert.equal(lines[1].estCost, 400)
})

test('the draft text names the business, lists items, caps long lists and is honest about partial costing', () => {
  const many = buildReorderLines(Array.from({ length: 12 }, (_, i) => item({ name: `Item ${String(i).padStart(2, '0')}`, costPrice: i === 0 ? 10 : null })))
  const t = orderDraftText('Mzansi Test Traders', many, 10)
  assert.match(t, /Mzansi Test Traders/)
  assert.match(t, /…and 2 more items/)
  assert.match(t, /items with a cost price only/)
  assert.equal(orderDraftText('X', []), '')
})

test('the unit "each" is not repeated after the quantity', () => {
  const t = orderDraftText('X', buildReorderLines([item({ name: 'Mug', unit: 'each' })]))
  assert.match(t, /Mug × 7\n/)
})
