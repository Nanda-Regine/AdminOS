import { test } from 'node:test'
import assert from 'node:assert/strict'
import { graduationOffer, GRADUATION_MIN_CONFIRMED } from '../lib/autonomy/graduation.ts'

test('offered after enough confirmed matches and no undos, only from tier B', () => {
  assert.equal(graduationOffer({ tier: 'B', confirmed: GRADUATION_MIN_CONFIRMED, undone: 0 }), true)
  assert.equal(graduationOffer({ tier: 'B', confirmed: GRADUATION_MIN_CONFIRMED - 1, undone: 0 }), false)
})

test('a single undo withholds the offer — the owner has shown a match was wrong', () => {
  assert.equal(graduationOffer({ tier: 'B', confirmed: 50, undone: 1 }), false)
})

test('never offered when already automatic or switched off', () => {
  assert.equal(graduationOffer({ tier: 'A', confirmed: 50, undone: 0 }), false)
  assert.equal(graduationOffer({ tier: 'C', confirmed: 50, undone: 0 }), false)
})
