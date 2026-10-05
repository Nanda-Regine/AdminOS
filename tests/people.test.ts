import test from 'node:test'
import assert from 'node:assert/strict'
import { wellnessValues, recentWellnessAvg } from '../lib/people/wellness.ts'
import { canSeeAnnouncement, type Viewer } from '../lib/people/announcements.ts'
import { DEFAULT_ROLE_PERMISSIONS, can, defaultRolesFor } from '../lib/auth/roleMatrix.ts'

// ── wellness_scores ─────────────────────────────────────────────────────────

test('wellness: reads { score, date } objects (the real shape)', () => {
  const raw = [{ score: 4, date: '2026-10-01' }, { score: 2, date: '2026-10-02' }]
  assert.deepEqual(wellnessValues(raw), [4, 2])
  assert.equal(recentWellnessAvg(raw), 3)
})

test('wellness: tolerates bare numbers, junk and non-arrays — never NaN', () => {
  assert.deepEqual(wellnessValues([5, { score: 'x' }, null, { date: 'y' }, 3]), [5, 3])
  assert.deepEqual(wellnessValues(null), [])
  assert.deepEqual(wellnessValues({ score: 4 }), [])
  assert.equal(recentWellnessAvg([]), null)
  assert.equal(recentWellnessAvg(undefined), null)
})

test('wellness: averages the most recent n, not the oldest', () => {
  const raw = [1, 1, 1, 5, 5, 5].map((score) => ({ score, date: '' }))
  assert.equal(recentWellnessAvg(raw, 3), 5)
})

// ── announcement visibility ─────────────────────────────────────────────────

const viewer = (role: keyof typeof DEFAULT_ROLE_PERMISSIONS, extra: Partial<Viewer> = {}): Viewer => ({
  userId: 'u1', staffId: 's1', permissions: DEFAULT_ROLE_PERMISSIONS[role], isSuperAdmin: false, ...extra,
})

test('announcements: everyone sees "all"', () => {
  assert.ok(canSeeAnnouncement({ audience: 'all' }, viewer('staff')))
  assert.ok(canSeeAnnouncement({ audience: null }, viewer('field_agent')))
})

test('announcements: "managers" hidden from staff, shown to managers and owners', () => {
  assert.equal(canSeeAnnouncement({ audience: 'managers' }, viewer('staff')), false)
  assert.ok(canSeeAnnouncement({ audience: 'managers' }, viewer('manager')))
  assert.ok(canSeeAnnouncement({ audience: 'managers' }, viewer('owner')))
})

test('announcements: "specific" matches staff id or user id only', () => {
  const a = { audience: 'specific', audience_ids: ['s1'] }
  assert.ok(canSeeAnnouncement(a, viewer('staff')))
  assert.ok(canSeeAnnouncement({ audience: 'specific', audience_ids: ['u1'] }, viewer('staff', { staffId: null })))
  assert.equal(canSeeAnnouncement(a, viewer('staff', { staffId: 's2', userId: 'u2' })), false)
  assert.equal(canSeeAnnouncement({ audience: 'specific', audience_ids: null }, viewer('staff')), false)
})

test('announcements: expired ones are hidden, even from publishers', () => {
  const past = { audience: 'all', expires_at: '2020-01-01T00:00:00Z' }
  assert.equal(canSeeAnnouncement(past, viewer('owner')), false)
  assert.ok(canSeeAnnouncement({ audience: 'all', expires_at: '2999-01-01T00:00:00Z' }, viewer('staff')))
})

test('announcements: unknown audience fails closed', () => {
  assert.equal(canSeeAnnouncement({ audience: 'everyone-lol' }, viewer('staff')), false)
})

// ── People / HR role matrix ─────────────────────────────────────────────────

test('managers approve leave but cannot read staff records or HR files', () => {
  const m = { permissions: DEFAULT_ROLE_PERMISSIONS.manager }
  assert.ok(can(m, 'leave.approve'))
  assert.equal(can(m, 'staff.read'), false)
  assert.equal(can(m, 'hr.records'), false)
  assert.equal(can(m, 'shifts.write'), false)
})

test('staff can clock, request leave, report safety, read the handbook — and nothing HR', () => {
  const s = { permissions: DEFAULT_ROLE_PERMISSIONS.staff }
  for (const a of ['clock.self', 'leave.request', 'safety.report', 'handbook.read', 'handbook.acknowledge', 'shifts.read', 'announcements.read'] as const) {
    assert.ok(can(s, a), a)
  }
  for (const a of ['staff.read', 'staff.write', 'leave.approve', 'hr.records', 'handbook.write', 'announcements.write', 'shifts.write'] as const) {
    assert.equal(can(s, a), false, a)
  }
})

test('handbook editing is owner/admin by default', () => {
  assert.deepEqual(defaultRolesFor('handbook.write').sort(), ['admin', 'owner'])
})
