'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Modal, FormField, inputCls, inputSty, Btn } from '@/components/ui/modal'
import { Plus } from 'lucide-react'

const EMPTY = {
  full_name: '',
  email: '',
  phone: '',
  company: '',
  contact_type: 'client' as const,
  source: '',
}

type FormState = typeof EMPTY

export function CreateContactModal() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  function handleOpen() {
    setForm(EMPTY)
    setError(null)
    setOpen(true)
  }

  function handleClose() {
    if (loading) return
    setOpen(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const body: Record<string, string | null> = {
        full_name: form.full_name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        company: form.company.trim() || null,
        contact_type: form.contact_type,
        source: form.source.trim() || null,
      }
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error ?? `Request failed (${res.status})`)
      }
      router.refresh()
      setOpen(false)
    } catch (err: unknown) {
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
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium"
        style={{ background: 'var(--indigo)', color: '#fff' }}
      >
        <Plus className="w-3.5 h-3.5" />
        New Contact
      </button>

      <Modal open={open} onClose={handleClose} title="New Contact" size="md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField label="Full Name *">
            <input
              name="full_name"
              type="text"
              required
              value={form.full_name}
              onChange={handleChange}
              placeholder="e.g. Thandi Dlamini"
              className={inputCls}
              style={inputSty}
            />
          </FormField>

          <FormField label="Email">
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              placeholder="email@example.com"
              className={inputCls}
              style={inputSty}
            />
          </FormField>

          <FormField label="Phone" hint="+27 format">
            <input
              name="phone"
              type="text"
              value={form.phone}
              onChange={handleChange}
              placeholder="+27 82 000 0000"
              className={inputCls}
              style={inputSty}
            />
          </FormField>

          <FormField label="Company">
            <input
              name="company"
              type="text"
              value={form.company}
              onChange={handleChange}
              placeholder="Company name"
              className={inputCls}
              style={inputSty}
            />
          </FormField>

          <FormField label="Contact Type">
            <select
              name="contact_type"
              value={form.contact_type}
              onChange={handleChange}
              className={inputCls}
              style={inputSty}
            >
              <option value="client">Client</option>
              <option value="supplier">Supplier</option>
              <option value="staff">Staff</option>
              <option value="unknown">Unknown</option>
            </select>
          </FormField>

          <FormField label="Source">
            <input
              name="source"
              type="text"
              value={form.source}
              onChange={handleChange}
              placeholder="e.g. referral, walk-in, WhatsApp"
              className={inputCls}
              style={inputSty}
            />
          </FormField>

          {error && (
            <p className="text-sm text-red-400 rounded-lg px-3 py-2"
              style={{ background: 'rgba(239,68,68,0.1)' }}>
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <Btn variant="ghost" onClick={handleClose} type="button">
              Cancel
            </Btn>
            <Btn type="submit" loading={loading}>
              Create Contact
            </Btn>
          </div>
        </form>
      </Modal>
    </>
  )
}
