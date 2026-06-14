'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Modal, FormField, inputCls, inputSty, Btn } from '@/components/ui/modal'

const CATEGORIES = [
  { value: 'general',    label: 'General' },
  { value: 'policy',     label: 'Policy' },
  { value: 'hr',         label: 'HR' },
  { value: 'finance',    label: 'Finance' },
  { value: 'operations', label: 'Operations' },
  { value: 'compliance', label: 'Compliance' },
  { value: 'product',    label: 'Product' },
]

function generateSlug(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export function CreateArticleModal() {
  const router = useRouter()
  const [open, setOpen]         = useState(false)
  const [title, setTitle]       = useState('')
  const [category, setCategory] = useState('general')
  const [slug, setSlug]         = useState('')
  const [body, setBody]         = useState('')
  const [published, setPublished] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)

  function handleOpen() {
    setTitle('')
    setCategory('general')
    setSlug('')
    setBody('')
    setPublished(false)
    setError(null)
    setOpen(true)
  }

  function handleClose() {
    if (!loading) setOpen(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const resolvedSlug = slug.trim() || generateSlug(title)

    try {
      const res = await fetch('/api/kb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title:     title.trim(),
          content:   body.trim(),
          slug:      resolvedSlug,
          category,
          published,
          tags:      [],
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error ?? `Error ${res.status}`)
      }

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
      <button
        type="button"
        onClick={handleOpen}
        className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2 rounded-xl text-sm transition-colors flex items-center gap-2"
      >
        <span>+</span>
        <span>New Article</span>
      </button>

      <Modal open={open} onClose={handleClose} title="New Article" size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">

          <FormField label="Title">
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Article title"
              className={inputCls}
              style={inputSty}
            />
          </FormField>

          <FormField label="Category">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={inputCls}
              style={inputSty}
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </FormField>

          <FormField label="Slug" hint="URL-friendly ID — auto-generated if blank">
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder={title ? generateSlug(title) : 'url-friendly-id'}
              className={inputCls}
              style={inputSty}
            />
          </FormField>

          <FormField label="Body">
            <textarea
              required
              rows={10}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your article content here..."
              className={inputCls}
              style={inputSty}
            />
          </FormField>

          <div className="flex items-center gap-3">
            <input
              id="kb-published"
              type="checkbox"
              checked={published}
              onChange={(e) => setPublished(e.target.checked)}
              className="w-4 h-4 rounded accent-indigo-600"
            />
            <label
              htmlFor="kb-published"
              className="text-sm font-medium select-none"
              style={{ color: 'var(--text-primary)' }}
            >
              Publish immediately (uncheck to save as draft)
            </label>
          </div>

          {error && (
            <p className="text-xs text-red-500 font-medium">{error}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Btn variant="ghost" onClick={handleClose} type="button">
              Cancel
            </Btn>
            <Btn type="submit" loading={loading}>
              {loading ? 'Saving…' : 'Create Article'}
            </Btn>
          </div>

        </form>
      </Modal>
    </>
  )
}
