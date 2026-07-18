import test from 'node:test'
import assert from 'node:assert/strict'
import { checkRecoveryMessage } from '../lib/debt/recoveryGuard.ts'

// Safety-critical: this guard is a legal control (Debt Collectors Act). A false
// "safe" is the dangerous direction — a fabricated legal threat on the wire.

test('blocks explicit English legal threats', () => {
  for (const m of [
    'We will take legal action against you',
    'This matter goes to court next week',
    'A letter of demand has been issued',
    'Our attorney will contact you',
    'You will be blacklisted at the credit bureau',
  ]) {
    assert.equal(checkRecoveryMessage(m).safe, false, m)
  }
})

test('blocks Afrikaans + isiZulu/isiXhosa legal terms', () => {
  assert.equal(checkRecoveryMessage('Ons prokureur sal jou kontak').safe, false)      // attorney (af)
  assert.equal(checkRecoveryMessage('Sizokusa enkantolo').safe, false)                 // to court (zu, stem nkantolo)
})

test('allows courteous factual reminders', () => {
  for (const m of [
    'Hi Thandi, invoice #12 for R500 is 3 days overdue. Please let us know if you would like to arrange payment.',
    'Just a friendly reminder about your outstanding balance — happy to discuss options.',
  ]) {
    assert.equal(checkRecoveryMessage(m).safe, true, m)
  }
})

test('word boundaries: does not false-positive on innocent words', () => {
  // "issue" must not trip "sue"; "courteous" must not trip "court"
  assert.equal(checkRecoveryMessage('We noticed an issue and want to be courteous about it.').safe, true)
})

test('empty or whitespace is not safe (never send blank)', () => {
  assert.equal(checkRecoveryMessage('').safe, false)
  assert.equal(checkRecoveryMessage('   ').safe, false)
})
