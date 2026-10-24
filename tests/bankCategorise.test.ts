import test from 'node:test'
import assert from 'node:assert/strict'
import { suggestCategory, vendorKey } from '../lib/bank/categorise.ts'
import { isValidKey } from '../lib/finance/chartOfAccounts.ts'

const cat = (d: string, dir: 'in' | 'out', rules = []) => suggestCategory(d, dir, rules)?.key ?? null

test('common SA debits map to the right account', () => {
  assert.equal(cat('FNB App Payment To Eskom Prepaid', 'out'), 'utilities')
  assert.equal(cat('Monthly Account Fee', 'out'), 'bank_charges')
  assert.equal(cat('POS Purchase Engen East London', 'out'), 'motor_vehicle')
  assert.equal(cat('Vodacom Airtime', 'out'), 'telephone')
  assert.equal(cat('Debit Order Discovery Insure', 'out'), 'insurance')
  assert.equal(cat('Uber Trip', 'out'), 'travel')
  assert.equal(cat('Google Workspace', 'out'), 'subscriptions')
  assert.equal(cat('Salaries Oct', 'out'), 'salaries')
})

test('ambiguous lines are left uncategorised, not guessed', () => {
  assert.equal(cat('FNB App Payment To Khulani Wholesalers', 'out'), null)
  assert.equal(cat('Payment Received Nomvula Sithole', 'in'), null)
  assert.equal(cat('', 'out'), null)
})

test('credits only use income rules', () => {
  assert.equal(cat('Interest earned', 'in'), 'interest')
  assert.equal(cat('Monthly Account Fee', 'in'), null) // a bank-fee word on a credit is not a bank charge
})

test('every key the rules can return exists in the chart of accounts', () => {
  const samples: [string, 'in' | 'out'][] = [
    ['Account fee', 'out'], ['Vodacom', 'out'], ['Eskom', 'out'], ['Discovery', 'out'], ['Engen', 'out'], ['Salary', 'out'],
    ['Rent', 'out'], ['Canva', 'out'], ['Facebook ads', 'out'], ['Waltons', 'out'], ['Accountant', 'out'], ['Uber', 'out'],
    ['KFC', 'out'], ['Hotel', 'out'], ['Training course', 'out'], ['Repairs', 'out'], ['Donation', 'out'],
    ['Interest earned', 'in'], ['Grant funding', 'in'], ['Rent received', 'in'], ['Membership', 'in'],
  ]
  for (const [d, dir] of samples) {
    const k = cat(d, dir)
    assert.ok(k, `no rule for ${d}`)
    assert.ok(isValidKey(dir === 'out' ? 'expense' : 'income', k!), `${k} is not a chart key`)
  }
})

test('a remembered tenant rule beats the built-in rules', () => {
  const rules = [{ match_text: vendorKey('POS Purchase Engen East London'), category: 'cogs', direction: 'out' as const }]
  const s = suggestCategory('POS Purchase Engen East London 4821', 'out', rules)
  assert.deepEqual(s, { key: 'cogs', source: 'tenant_rule' })
})

test('vendor keys collapse card tails and bank boilerplate', () => {
  assert.equal(vendorKey('POS Purchase Engen East London 4821'), vendorKey('POS Purchase Engen East London 9930'))
  assert.equal(vendorKey('FNB App Payment To Khulani Wholesalers Ref 12345'), 'khulani wholesalers')
  assert.equal(vendorKey('1234567'), '')
})
