import test from 'node:test'
import assert from 'node:assert/strict'
import { boardColumns, isOpenTask } from '../lib/ops/tasks.ts'

const t = (status: string) => ({ status })

test('a review task is shown on the board, not lost', () => {
  const cols = boardColumns([t('todo'), t('in_progress'), t('review'), t('done'), t('cancelled')])
  assert.equal(cols.review.length, 1)
  const shown = cols.todo.length + cols.inProgress.length + cols.review.length + cols.done.length
  assert.equal(shown, 4, 'every non-cancelled task is in exactly one column; cancelled is hidden')
})

test('open means todo, in_progress or review (same rule as Ops and the API)', () => {
  for (const s of ['todo', 'in_progress', 'review']) assert.equal(isOpenTask(s), true, s)
  for (const s of ['done', 'cancelled', 'completed', '', null, undefined]) assert.equal(isOpenTask(s as string), false, String(s))
})

test('a done task is not open, so it can never be flagged overdue', () => {
  assert.equal(isOpenTask('done'), false)
})
