'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Modal, FormField, inputCls, inputSty, Btn } from '@/components/ui/modal'
import { useOpenOnParam } from '@/lib/hooks/useOpenOnParam'

interface Props {
  contacts: Array<{ id: string; full_name: string }>
}

export function CreateContractModal({ contacts }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  useOpenOnParam('new', () => setOpen(true))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [title, setTitle] = useState('')
  const [contactId, setContactId] = useState('')
  const [body, setBody] = useState('')
  const [expiryDate, setExpiryDate] = useState('')

  function resetForm() {
    setTitle('')
    setContactId('')
    setBody('')
    setExpiryDate('')
    setError(null)
  }

  function handleClose() {
    setOpen(false)
    resetForm()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const payload: Record<string, unknown> = {
        title,
        content: { body },
      }
      if (contactId) payload.contactId = contactId
      if (expiryDate) payload.endDate = expiryDate

      const res = await fetch('/api/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data?.error ?? `Error ${res.status}`)
        return
      }

      router.refresh()
      handleClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2 rounded-xl text-sm transition-colors"
      >
        + New Contract
      </button>

      <Modal open={open} onClose={handleClose} title="New Contract" size="lg">
        <form onSubmit={handleSubmit} className="space-y-5">

          <FormField label="Contract Title">
            <input
              type="text"
              required
              value={title}
              onChange={e => setTitle(e.target.value)}
              className={inputCls}
              style={inputSty}
              placeholder="e.g. Service Agreement — Acme Ltd"
            />
          </FormField>

          <FormField label="Contact">
            <select
              value={contactId}
              onChange={e => setContactId(e.target.value)}
              className={inputCls}
              style={inputSty}
            >
              <option value="">— No contact —</option>
              {contacts.map(c => (
                <option key={c.id} value={c.id}>{c.full_name}</option>
              ))}
            </select>
          </FormField>

          <FormField label="Contract Body">
            <textarea
              required
              rows={8}
              value={body}
              onChange={e => setBody(e.target.value)}
              className={inputCls}
              style={inputSty}
              placeholder="Enter contract terms and conditions..."
            />
          </FormField>

          <FormField label="Expiry Date" hint="Optional — leave blank for open-ended contracts">
            <input
              type="date"
              value={expiryDate}
              onChange={e => setExpiryDate(e.target.value)}
              className={inputCls}
              style={inputSty}
            />
          </FormField>

          {error && (
            <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-3 pt-1">
            <Btn type="button" variant="ghost" onClick={handleClose}>Cancel</Btn>
            <Btn type="submit" loading={loading}>Create Contract</Btn>
          </div>
        </form>
      </Modal>
    </>
  )
}
