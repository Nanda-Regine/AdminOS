/**
 * Task ordering and statuses — one definition for the API, the board and the
 * mobile app. No imports (tests load it directly).
 *
 * `order('priority')` in SQL sorts the text alphabetically — high, low,
 * medium, urgent — so urgent tasks were listed *last* on the board.
 */

export const TASK_COLUMNS =
  'id, title, description, status, priority, due_date, assigned_to, project_id, contact_id, invoice_id, source, created_by, completed_at, created_at'

export const TASK_STATUSES = ['todo', 'in_progress', 'review', 'done', 'cancelled'] as const
export const TASK_PRIORITIES = ['urgent', 'high', 'medium', 'low'] as const
export const OPEN_TASK_STATUSES = ['todo', 'in_progress', 'review'] as const

/** Open = still to be done. Matches the Ops tile and the API (review counts, cancelled does not). */
export const isOpenTask = (status: string | null | undefined): boolean =>
  (OPEN_TASK_STATUSES as readonly string[]).includes(status ?? '')

/**
 * Split tasks into board columns. Every non-cancelled task lands in exactly
 * one column, so the board and its counts can't disagree; `review` used to
 * be counted in the subtitle total but shown nowhere.
 */
export function boardColumns<T extends { status?: string | null }>(tasks: T[]) {
  return {
    todo:       tasks.filter(t => t.status === 'todo'),
    inProgress: tasks.filter(t => t.status === 'in_progress'),
    review:     tasks.filter(t => t.status === 'review'),
    done:       tasks.filter(t => t.status === 'done'),
  }
}

const RANK: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 }

interface Sortable { priority?: string | null; due_date?: string | null; created_at?: string | null }

/** Urgent first, then soonest due (undated last), then oldest created. */
export function compareTasks(a: Sortable, b: Sortable): number {
  const p = (RANK[a.priority ?? 'medium'] ?? 2) - (RANK[b.priority ?? 'medium'] ?? 2)
  if (p) return p
  const ad = a.due_date ? Date.parse(a.due_date) : Infinity
  const bd = b.due_date ? Date.parse(b.due_date) : Infinity
  if (ad !== bd) return ad - bd
  return (a.created_at ?? '').localeCompare(b.created_at ?? '')
}
