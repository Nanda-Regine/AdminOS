import test from 'node:test'
import assert from 'node:assert/strict'
import {
  generateInviteCode, normaliseInviteCode, hashInviteCode, generatedLoginEmail,
  passwordProblem, waDigits, CODE_ALPHABET, GENERATED_LOGIN_DOMAIN,
} from '../lib/people/invites.ts'
import { isTenantReceiptRef, receiptHref, sniffReceiptType, receiptPath } from '../lib/expenses/receipts.ts'
import { compareTasks } from '../lib/ops/tasks.ts'
import { drawsAnnualBalance, needsMedicalCertificate } from '../lib/people/leaveTypes.ts'
import { can, ACTIONS } from '../lib/auth/roleMatrix.ts'

// ── invite codes ────────────────────────────────────────────────────────────

test('invite: codes are XXXX-XXXX from the unambiguous alphabet', () => {
  for (let i = 0; i < 200; i++) {
    const c = generateInviteCode()
    assert.match(c, /^[A-Z0-9]{4}-[A-Z0-9]{4}$/)
    for (const ch of c.replace('-', '')) assert.ok(CODE_ALPHABET.includes(ch), ch)
  }
})

test('invite: normalising accepts how people actually type a code', () => {
  assert.equal(normaliseInviteCode('abcd-efgh'), 'ABCD-EFGH')
  assert.equal(normaliseInviteCode(' ABCD EFGH '), 'ABCD-EFGH')
  assert.equal(normaliseInviteCode('abcdefgh'), 'ABCD-EFGH')
  assert.equal(normaliseInviteCode('ABCD-EFG'), null)         // too short
  assert.equal(normaliseInviteCode('ABCD-EFG0'), null)        // 0 is not in the alphabet
  assert.equal(normaliseInviteCode('ABCD-EFGI'), null)        // nor I
})

test('invite: the stored hash is deterministic and not the code', () => {
  const h = hashInviteCode('ABCD-EFGH')
  assert.equal(h, hashInviteCode('ABCD-EFGH'))
  assert.notEqual(h, hashInviteCode('ABCD-EFGJ'))
  assert.match(h, /^[a-f0-9]{64}$/)
})

test('invite: generated logins live on the no-mail staff domain', () => {
  const e = generatedLoginEmail('Thandiwe Nkosi')
  assert.match(e, new RegExp(`^thandiwe\\.[a-z0-9]{4}@${GENERATED_LOGIN_DOMAIN.replace(/\./g, '\\.')}$`))
  assert.match(generatedLoginEmail('Zoë'), /^zoe\./)          // accents folded
  assert.match(generatedLoginEmail('   '), /^staff\./)
})

test('invite: password rule', () => {
  assert.ok(passwordProblem('short1'))
  assert.ok(passwordProblem('onlyletters'))
  assert.ok(passwordProblem('12345678'))
  assert.ok(passwordProblem('Password123'))
  assert.equal(passwordProblem('ubuntu-2026-kraal'), null)
})

test('invite: SA numbers become wa.me digits', () => {
  assert.equal(waDigits('082 123 4567'), '27821234567')
  assert.equal(waDigits('+27 82 123 4567'), '27821234567')
  assert.equal(waDigits('0027821234567'), '27821234567')
  assert.equal(waDigits('12345'), null)
  assert.equal(waDigits(null), null)
})

// ── receipts ────────────────────────────────────────────────────────────────

const T = '11111111-2222-3333-4444-555555555555'
const F = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'

test('receipts: a stored ref is only valid in its own tenant folder', () => {
  assert.ok(isTenantReceiptRef(`storage:expense-receipts/${T}/${F}.jpg`, T))
  assert.ok(!isTenantReceiptRef(`storage:expense-receipts/${F}/${F}.jpg`, T))       // other tenant
  assert.ok(!isTenantReceiptRef(`storage:expense-receipts/${T}/../${F}.jpg`, T))    // traversal
  assert.ok(!isTenantReceiptRef(`storage:expense-receipts/${T}/${F}.exe`, T))
  assert.ok(!isTenantReceiptRef(`https://evil.example/${T}/${F}.jpg`, T))
  assert.equal(receiptPath(`storage:expense-receipts/${T}/${F}.png`), `${T}/${F}.png`)
})

test('receipts: links are never javascript: or http:', () => {
  assert.equal(receiptHref({ id: 'x', receipt_url: 'javascript:alert(1)' }), null)
  assert.equal(receiptHref({ id: 'x', receipt_url: 'http://plain.example/r.jpg' }), null)
  assert.equal(receiptHref({ id: 'x', receipt_url: 'https://cdn.example/r.jpg' }), 'https://cdn.example/r.jpg')
  assert.equal(receiptHref({ id: 'x', receipt_url: `storage:expense-receipts/${T}/${F}.jpg` }), '/api/expenses/x/receipt')
  assert.equal(receiptHref({ id: 'x', receipt_url: null }), null)
})

test('receipts: type comes from the bytes, not the name', () => {
  assert.equal(sniffReceiptType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))?.ext, 'jpg')
  assert.equal(sniffReceiptType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))?.ext, 'png')
  assert.equal(sniffReceiptType(new TextEncoder().encode('%PDF-1.7'))?.ext, 'pdf')
  assert.equal(sniffReceiptType(new TextEncoder().encode('RIFF....WEBPVP8 '))?.ext, 'webp')
  assert.equal(sniffReceiptType(new TextEncoder().encode('<script>alert(1)</script>')), null)
  assert.equal(sniffReceiptType(new Uint8Array([])), null)
})

// ── tasks ───────────────────────────────────────────────────────────────────

test('tasks: urgent first, then soonest due, undated last', () => {
  const tasks = [
    { id: 'low', priority: 'low', due_date: '2026-10-06T00:00:00Z' },
    { id: 'urgent', priority: 'urgent', due_date: null },
    { id: 'high-late', priority: 'high', due_date: '2026-12-01T00:00:00Z' },
    { id: 'high-soon', priority: 'high', due_date: '2026-10-07T00:00:00Z' },
    { id: 'high-none', priority: 'high', due_date: null },
  ]
  assert.deepEqual([...tasks].sort(compareTasks).map((t) => t.id), ['urgent', 'high-soon', 'high-late', 'high-none', 'low'])
})

// ── leave types ─────────────────────────────────────────────────────────────

test('leave: only annual leave draws down the annual balance', () => {
  assert.equal(drawsAnnualBalance('annual'), true)
  assert.equal(drawsAnnualBalance(undefined), true)     // pre-migration rows
  assert.equal(drawsAnnualBalance('sick'), false)
  assert.equal(drawsAnnualBalance('family_responsibility'), false)
  assert.equal(needsMedicalCertificate('sick', 3), true)
  assert.equal(needsMedicalCertificate('sick', 2), false)
  assert.equal(needsMedicalCertificate('annual', 10), false)
})

// ── role matrix additions ───────────────────────────────────────────────────

test('matrix: the directory is open to members, tenant alerts are not', () => {
  assert.equal(ACTIONS['staff.directory'], 'member')
  assert.equal(can({ permissions: ['view_own_data_only'] }, 'staff.directory'), true)
  assert.equal(can({ permissions: ['view_own_data_only'] }, 'alerts.read'), false)
  assert.equal(can({ permissions: ['view_analytics'] }, 'alerts.read'), true)
})
