import { test } from 'node:test'
import assert from 'node:assert/strict'
import { jobState, JOBS } from '../lib/jobs/registry.ts'

const now = new Date('2026-11-02T10:00:00Z')
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000).toISOString()

test('never seen is "waiting", not "late" — a fresh deploy must not cry wolf', () => {
  assert.equal(jobState(null, 30, now), 'waiting')
  assert.equal(jobState({ last_ok_at: null, last_error_at: null }, 30, now), 'waiting')
})

test('ran inside its window → ok; past it → late', () => {
  assert.equal(jobState({ last_ok_at: hoursAgo(20), last_error_at: null }, 30, now), 'ok')
  assert.equal(jobState({ last_ok_at: hoursAgo(31), last_error_at: null }, 30, now), 'late')
})

test('the Mon–Fri brief is not late on a Monday morning after a normal weekend gap', () => {
  const brief = JOBS.find((j) => j.id === 'fan-out-brief-cron')!
  assert.equal(jobState({ last_ok_at: hoursAgo(72), last_error_at: null }, brief.maxGapHours, now), 'ok')
  assert.equal(jobState({ last_ok_at: hoursAgo(96), last_error_at: null }, brief.maxGapHours, now), 'late')
})

test('a failure newer than the last success is "failing"; a later success clears it', () => {
  assert.equal(jobState({ last_ok_at: hoursAgo(10), last_error_at: hoursAgo(2) }, 30, now), 'failing')
  assert.equal(jobState({ last_ok_at: hoursAgo(1), last_error_at: hoursAgo(2) }, 30, now), 'ok')
  assert.equal(jobState({ last_ok_at: null, last_error_at: hoursAgo(2) }, 30, now), 'failing')
})

test('registry ids are unique and every window is positive', () => {
  assert.equal(new Set(JOBS.map((j) => j.id)).size, JOBS.length)
  assert.ok(JOBS.every((j) => j.maxGapHours > 0 && j.label.length > 0))
})
