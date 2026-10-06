import test from 'node:test'
import assert from 'node:assert/strict'
import {
  isVatNumber, isPayeRef, isSdlRef, isUifRef, isCipcNumber, isBranchCode, isBankAccount,
  employerRefMismatch, businessTypeOptions, BUSINESS_TYPE_VALUES,
} from '../lib/business/profile.ts'

test('SA tax references (SARS formats)', () => {
  assert.ok(isVatNumber('4123456789'))
  assert.ok(isVatNumber('4123 456 789'))   // pasted with spaces
  assert.ok(!isVatNumber('5123456789'))    // VAT numbers start with 4
  assert.ok(!isVatNumber('412345678'))
  assert.ok(isPayeRef('7123456789'))
  assert.ok(!isPayeRef('4123456789'))
  assert.ok(isSdlRef('L123456789') && isSdlRef('l123456789'))
  assert.ok(isUifRef('U123456789') && !isUifRef('U12345678'))
})

test('CIPC, branch code and account number', () => {
  assert.ok(isCipcNumber('2019/123456/07'))
  assert.ok(!isCipcNumber('2019-123456-07'))
  assert.ok(isBranchCode('250655') && !isBranchCode('25065'))
  assert.ok(isBankAccount('62012345601') && !isBankAccount('12ab'))
})

test('SDL/UIF must share the PAYE number\'s last 9 digits', () => {
  assert.equal(employerRefMismatch('7123456789', 'L123456789', 'U123456789'), null)
  assert.match(employerRefMismatch('7123456789', 'L999999999', null)!, /SDL/)
  assert.match(employerRefMismatch('7123456789', null, 'U999999999')!, /UIF/)
  assert.equal(employerRefMismatch(null, 'L999999999', 'U111111111'), null) // nothing to compare against
})

test('picker hides unmarketed industries unless already chosen', () => {
  const plain = businessTypeOptions(null).map((b) => b.value)
  assert.ok(!plain.includes('clinic') && !plain.includes('legal'))
  assert.ok(businessTypeOptions('clinic').some((b) => b.value === 'clinic'))
  assert.equal(BUSINESS_TYPE_VALUES.length, 15) // every enum value stays valid on the server
})
