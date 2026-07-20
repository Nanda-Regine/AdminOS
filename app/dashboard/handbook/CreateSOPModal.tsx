'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Modal, FormField, inputCls, inputSty, Btn } from '@/components/ui/modal'
import { useOpenOnParam } from '@/lib/hooks/useOpenOnParam'

const CATEGORIES = ['HR', 'Operations', 'Finance', 'Safety', 'Compliance', 'General']

export function CreateSOPModal() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  useOpenOnParam('new', () => setOpen(true))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('General')
  const [content, setContent] = useState('')
  const [acknowledgementRequired, setAcknowledgementRequired] = useState(false)

  function reset() {
    setTitle('')
    setCategory('General')
    setContent('')
    setAcknowledgementRequired(false)
    setError(null)
  }

  function handleClose() {
    if (loading) return
    setOpen(false)
    reset()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/sops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          category: category.toLowerCase(),
          content: { text: content },
          requiresAcknowledgement: acknowledgementRequired,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Error ${res.status}`)
      }
      router.refresh()
      setOpen(false)
      reset()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
      >
        + New SOP
      </button>

      <Modal open={open} onClose={handleClose} title="New SOP" size="lg">
        <form onSubmit={handleSubmit} className="space-y-5">

          <FormField label="Title">
            <input
              type="text"
              required
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Onboarding Checklist"
              className={inputCls}
              style={inputSty}
            />
          </FormField>

          <FormField label="Category">
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className={inputCls}
              style={inputSty}
            >
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </FormField>

          <FormField label="Content" hint="Write the full procedure steps here.">
            <textarea
              required
              rows={8}
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Step 1: …&#10;Step 2: …"
              className={inputCls}
              style={inputSty}
            />
          </FormField>

          <div className="flex items-center gap-3">
            <input
              id="ack-required"
              type="checkbox"
              checked={acknowledgementRequired}
              onChange={e => setAcknowledgementRequired(e.target.checked)}
              className="w-4 h-4 rounded accent-indigo-600 cursor-pointer"
            />
            <label htmlFor="ack-required" className="text-sm cursor-pointer" style={{ color: 'var(--text-primary)' }}>
              Requires acknowledgement from staff
            </label>
          </div>

          {error && (
            <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-3 pt-1">
            <Btn variant="ghost" onClick={handleClose}>Cancel</Btn>
            <Btn type="submit" loading={loading}>Create SOP</Btn>
          </div>

        </form>
      </Modal>
    </>
  )
}
