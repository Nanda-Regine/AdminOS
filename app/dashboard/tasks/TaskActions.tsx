'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useOpenOnParam } from '@/lib/hooks/useOpenOnParam'
import { Modal, FormField, inputCls, inputSty, Btn } from '@/components/ui/modal'

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

  useOpenOnParam('new', () => setOpen(true))

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

  function handleClose() { if (!loading) { resetForm(); setOpen(false) } }

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

      <Modal open={open} onClose={handleClose} title="New Task" size="md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField label="Title *">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="What needs to be done?"
              className={inputCls}
              style={inputSty}
            />
          </FormField>

          <FormField label="Description">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Optional details..."
              className={inputCls}
              style={inputSty}
            />
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="Priority">
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as typeof priority)}
                className={inputCls}
                style={inputSty}
              >
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </FormField>

            <FormField label="Due Date">
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className={inputCls}
                style={inputSty}
              />
            </FormField>
          </div>

          <FormField label="Assign To">
            <select
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              className={inputCls}
              style={inputSty}
            >
              <option value="">(Unassigned)</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}
                </option>
              ))}
            </select>
          </FormField>

          {error && (
            <p className="text-xs text-red-500 on-light bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <Btn type="button" variant="ghost" onClick={handleClose}>Cancel</Btn>
            <Btn type="submit" loading={loading}>{loading ? 'Creating…' : 'Create Task'}</Btn>
          </div>
        </form>
      </Modal>
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
      const res = await fetch(`/api/tasks/${taskId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ status: nextStatus }),
      })
      // Previously this ignored the response entirely — a failed PATCH (403,
      // 400, etc.) still called router.refresh() as if it had worked, so the
      // button silently did nothing with no error surfaced anywhere.
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        console.error('Failed to move task:', body?.error ?? `HTTP ${res.status}`)
        return
      }
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
