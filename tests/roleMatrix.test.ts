import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ACTIONS, ALL_PERMISSIONS, DEFAULT_ROLE_PERMISSIONS, MEMBER, ROLES,
  can, defaultRolesFor, isRoleName, seesOnlyOwnData, type Action,
} from '../lib/auth/roleMatrix.ts'

const actions = Object.keys(ACTIONS) as Action[]

test('every action needs a real permission or member', () => {
  for (const a of actions) {
    const need = ACTIONS[a]
    assert.ok(need === MEMBER || (ALL_PERMISSIONS as readonly string[]).includes(need), `${a} → ${need}`)
  }
})

test('default role sets only reference real permissions', () => {
  for (const role of ROLES) {
    for (const p of DEFAULT_ROLE_PERMISSIONS[role]) {
      assert.ok((ALL_PERMISSIONS as readonly string[]).includes(p), `${role}: ${p}`)
    }
  }
})

test('owner can do everything', () => {
  for (const a of actions) assert.ok(can({ permissions: DEFAULT_ROLE_PERMISSIONS.owner }, a), a)
})

test('client can only do member (own-data) actions', () => {
  for (const a of actions) {
    assert.equal(can({ permissions: DEFAULT_ROLE_PERMISSIONS.client }, a), ACTIONS[a] === MEMBER, a)
  }
})

test('admin can do everything except billing', () => {
  for (const a of actions) {
    assert.equal(can({ permissions: DEFAULT_ROLE_PERMISSIONS.admin }, a), a !== 'billing.manage', a)
  }
})

// The specific holes the 2026-10-04 audit found — pin them shut.
test('staff cannot distribute payroll, push to colleagues, or read staff records', () => {
  const staff = { permissions: DEFAULT_ROLE_PERMISSIONS.staff }
  const denied: Action[] = [
    'payroll.distribute', 'payroll.run', 'payroll.read', 'broadcasts.send',
    'staff.read', 'hr.records', 'billing.manage',
  ]
  for (const a of denied) assert.equal(can(staff, a), false, a)
})

test('manager approves leave and handles invoices but does not see payroll', () => {
  const m = { permissions: DEFAULT_ROLE_PERMISSIONS.manager }
  assert.ok(can(m, 'leave.approve'))
  assert.ok(can(m, 'invoices.write'))
  assert.equal(can(m, 'payroll.read'), false)
})

test('super-admin bypasses the matrix', () => {
  assert.ok(can({ permissions: [], isSuperAdmin: true }, 'billing.manage'))
})

test('defaultRolesFor + isRoleName', () => {
  assert.deepEqual(defaultRolesFor('billing.manage'), ['owner'])
  assert.deepEqual(defaultRolesFor('payroll.distribute'), ['owner', 'admin'])
  assert.deepEqual(defaultRolesFor('clock.self'), [...ROLES])
  assert.ok(isRoleName('field_agent'))
  assert.equal(isRoleName('hr_manager'), false)
  assert.equal(isRoleName('super_admin'), false)
})

test('only staff, field_agent and client are scoped to their own records', () => {
  const scoped = ROLES.filter((r) => seesOnlyOwnData({ permissions: DEFAULT_ROLE_PERMISSIONS[r] }))
  assert.deepEqual([...scoped].sort(), ['client', 'field_agent', 'staff'])
  // A super-admin is never scoped, whatever their role grants.
  assert.equal(seesOnlyOwnData({ permissions: DEFAULT_ROLE_PERMISSIONS.staff, isSuperAdmin: true }), false)
})
