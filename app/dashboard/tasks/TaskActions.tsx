'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

interface StaffMember {
  id: string
  full_name: string
}

/* ------------------------------------------------------------------ */
/*  Status cycle helpers                                                */
/* ------------------------------------------------------------------ */

const STATUS_CYCLE: Record<string, string> = {
  todo:        'in_progress',
  in_progress: 'done',
  done:        'todo',
}

const STATUS_LABEL: Record<string, string> = {
  todo:        'To Do',
  in_progress: 'In Progress',
  done:        'Done',
}

/* ------------------------------------------------------------------ */
/*  A) CreateTaskModal                                                  */
/* ------------------------------------------------------------------ */

export function CreateTaskModal({ staff }: { staff: StaffMember[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [title, setTitle]           = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority]     = useState<'urgent' | 'high' | 'medium' | 'low'>('medium')
  const [dueDate, setDueDate]       = useState('')
  const [assignedTo, setAssignedTo] = useState('')

  function resetForm() {
    setTitle('')
    setDescription('')
    setPriority('medium')
    setDueDate('')
    setAssignedTo('')
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return

    setLoading(true)
    setError(null)

    try {
      const body: Record<string, unknown> = {
        title:    title.trim(),
        priority,
        source:   'manual',
      }
      if (description.trim()) body.description = description.trim()
      if (assignedTo)          body.assignedTo  = assignedTo
      if (dueDate)             body.dueDate     = new Date(dueDate).toISOString()

      const res = await fetch('/api/tasks', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      })

      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json?.error ?? `Error ${res.status}`)
      }

      resetForm()
      setOpen(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Trigger */}
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 transition-colors"
      >
        <span className="text-base leading-none">+</span>
        New Task
      </button>

      {/* Backdrop + Modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={(e) => { if (e.target === e.currentTarget) { resetForm(); setOpen(false) } }}
        >
          <div className="w-full max-w-md rounded-2xl bg-[var(--surface-1)] shadow-xl ring-1 ring-gray-200 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
              <h2 className="text-base font-semibold text-[var(--text-primary)]">New Task</h2>
              <button
                onClick={() => { resetForm(); setOpen(false) }}
                className="text-[var(--text-dim)] hover:text-[var(--text-muted)] text-xl leading-none"
                aria-label="Close"
              >
                &times;
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
              {/* Title */}
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Title <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  placeholder="What needs to be done?"
                  className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-dim)] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="Optional details..."
                  className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-dim)] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                />
              </div>

              {/* Priority + Due Date (side by side) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                    Priority
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as typeof priority)}
                    className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    <option value="urgent">Urgent</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Assign To */}
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Assign To
                </label>
                <select
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="">(Unassigned)</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Error */}
              {error && (
                <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => { resetForm(); setOpen(false) }}
                  className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text-muted)] hover:bg-[var(--surface-hover)] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !title.trim()}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? 'Creating...' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

/* ------------------------------------------------------------------ */
/*  B) MoveTaskButton                                                   */
/* ------------------------------------------------------------------ */

export function MoveTaskButton({
  taskId,
  currentStatus,
}: {
  taskId: string
  currentStatus: string
}) {
  const router  = useRouter()
  const [busy, setBusy] = useState(false)

  const nextStatus = STATUS_CYCLE[currentStatus] ?? 'todo'

  async function handleMove() {
    if (busy) return
    setBusy(true)
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ status: nextStatus }),
      })
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      onClick={handleMove}
      disabled={busy}
      title={`Move to ${STATUS_LABEL[nextStatus] ?? nextStatus}`}
      className="inline-flex items-center gap-1 text-xs py-1 px-2 rounded-md border border-[var(--border)] text-[var(--text-muted)] hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
    >
      <span>{STATUS_LABEL[currentStatus] ?? currentStatus}</span>
      <span className="text-[10px]">&#8594;</span>
    </button>
  )
}
