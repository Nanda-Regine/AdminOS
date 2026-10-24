import test from 'node:test'
import assert from 'node:assert/strict'
import { isLowStock } from '../lib/inventory/lowStock.ts'

test('stock at or below a configured reorder level is low', () => {
  assert.equal(isLowStock({ current_stock: 3, reorder_level: 5 }), true)
  assert.equal(isLowStock({ current_stock: 5, reorder_level: 5 }), true)
  assert.equal(isLowStock({ current_stock: 6, reorder_level: 5 }), false)
})

test('a product with no reorder level set is never low (the default is 0)', () => {
  assert.equal(isLowStock({ current_stock: 0, reorder_level: 0 }), false)
  assert.equal(isLowStock({ current_stock: 0, reorder_level: null }), false)
})

test('inactive products are never low; missing active flag counts as active', () => {
  assert.equal(isLowStock({ current_stock: 0, reorder_level: 5, active: false }), false)
  assert.equal(isLowStock({ current_stock: 0, reorder_level: 5, active: true }), true)
  assert.equal(isLowStock({ current_stock: 0, reorder_level: 5 }), true)
})

test('numeric strings from PostgREST numerics are handled', () => {
  assert.equal(isLowStock({ current_stock: '2.000', reorder_level: '5.000' }), true)
})
