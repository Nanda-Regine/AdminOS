import test from 'node:test'
import assert from 'node:assert/strict'
import { parseBankAmount, parseBankDate, parseBankStatement, splitCsvLine } from '../lib/bank/parseStatement.ts'

test('amounts: SA and international formats', () => {
  assert.equal(parseBankAmount('1,234.56'), 1234.56)
  assert.equal(parseBankAmount('1 234,56'), 1234.56)
  assert.equal(parseBankAmount('R 1 234,56'), 1234.56)
  assert.equal(parseBankAmount('R1,234,567.89'), 1234567.89)
  assert.equal(parseBankAmount('1.234.567,89'), 1234567.89)
  assert.equal(parseBankAmount('-250.00'), -250)
  assert.equal(parseBankAmount('−12.5'), -12.5)
  assert.equal(parseBankAmount('(250.00)'), -250)
  assert.equal(parseBankAmount('250.00 Dr'), -250)
  assert.equal(parseBankAmount('250.00Cr'), 250)
  assert.equal(parseBankAmount('1234,5'), 1234.5)
  assert.equal(parseBankAmount('1,234'), 1234)
  assert.equal(parseBankAmount('+99.99'), 99.99)
})

test('amounts: blanks and garbage are null, never 0', () => {
  assert.equal(parseBankAmount(''), null)
  assert.equal(parseBankAmount('   '), null)
  assert.equal(parseBankAmount('n/a'), null)
  assert.equal(parseBankAmount('R'), null)
})

test('dates: every SA bank format, invalid dates rejected', () => {
  assert.equal(parseBankDate('2026-10-05'), '2026-10-05')
  assert.equal(parseBankDate('2026/10/05'), '2026-10-05')
  assert.equal(parseBankDate('05/10/2026'), '2026-10-05')
  assert.equal(parseBankDate('5-10-2026'), '2026-10-05')
  assert.equal(parseBankDate('05 Oct 2026'), '2026-10-05')
  assert.equal(parseBankDate('5 October 2026'), '2026-10-05')
  assert.equal(parseBankDate('20261005'), '2026-10-05')
  assert.equal(parseBankDate('2026-10-05 14:22:10'), '2026-10-05')
  assert.equal(parseBankDate('31/02/2026'), null)
  assert.equal(parseBankDate('13/13/2026'), null)
  assert.equal(parseBankDate('Total'), null)
  assert.equal(parseBankDate(''), null)
})

test('quoted fields keep their commas and escaped quotes', () => {
  assert.deepEqual(splitCsvLine('a,"b, c","d ""e"" f",g', ','), ['a', 'b, c', 'd "e" f', 'g'])
})

test('FNB-style: preamble lines, quoted description, single signed amount', () => {
  const csv = [
    'Account Number,62012345678',
    'Account Name,MZANSI TRADERS',
    '',
    'Date,Amount,Balance,Description',
    '2026/10/01,-185.00,12815.00,"FNB App Payment To Eskom Prepaid"',
    '2026/10/02,5560.00,18375.00,"FNB App Rtc Credit Riaan Pretorius INV-20260518-1009"',
    '2026/10/03,-65.00,18310.00,Monthly Account Fee',
    'Closing balance,,18310.00,',
  ].join('\n')
  const r = parseBankStatement(csv)
  assert.equal(r.error, null)
  assert.equal(r.rows.length, 3)
  assert.deepEqual(r.rows[0], { date: '2026-10-01', description: 'FNB App Payment To Eskom Prepaid', amount: -185, balance: 12815 })
  assert.equal(r.rows[1].amount, 5560)
  assert.equal(r.rows[2].amount, -65)
})

test('Capitec-style: semicolons and separate Debit/Credit columns with decimal commas', () => {
  const csv = [
    'Transaction Date;Description;Debit;Credit;Balance',
    '05/10/2026;POS Purchase Engen East London;850,40;;4 149,60',
    '06/10/2026;Payment Received Nomvula Sithole;;1 668,00;5 817,60',
  ].join('\n')
  const r = parseBankStatement(csv)
  assert.equal(r.error, null)
  assert.equal(r.rows.length, 2)
  assert.equal(r.rows[0].amount, -850.4)
  assert.equal(r.rows[0].balance, 4149.6)
  assert.equal(r.rows[1].amount, 1668)
  assert.equal(r.rows[1].date, '2026-10-06')
})

test('Tyme/ISO style with Money In / Money Out', () => {
  const csv = ['Date,Description,Money In,Money Out,Balance', '2026-10-07,Interest earned,12.34,,1012.34', '2026-10-08,Netflix,,199.00,813.34'].join('\n')
  const r = parseBankStatement(csv)
  assert.deepEqual(r.rows.map((x) => x.amount), [12.34, -199])
})

test('rows without an amount or description are counted as skipped, not guessed', () => {
  const csv = ['Date,Description,Amount', '2026-10-01,Good line,-10.00', '2026-10-02,,-20.00', '2026-10-03,No amount,'].join('\n')
  const r = parseBankStatement(csv)
  assert.equal(r.rows.length, 1)
  assert.equal(r.skipped, 2)
})

test('a file with no recognisable header returns a friendly error', () => {
  const r = parseBankStatement('hello,world\n1,2')
  assert.equal(r.rows.length, 0)
  assert.match(r.error ?? '', /column headings/)
})

test('BOM and Windows line endings are handled', () => {
  const r = parseBankStatement('﻿Date,Description,Amount\r\n2026-10-01,Test,-5.00\r\n')
  assert.equal(r.rows.length, 1)
})
