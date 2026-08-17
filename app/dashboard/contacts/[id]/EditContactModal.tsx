'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Modal, FormField, inputCls, inputSty, Btn } from '@/components/ui/modal'

interface Contact {
  id: string
  full_name: string | null
  email: string | null
  phone: string | null
  company: string | null
  contact_type: string | null
  notes: string | null
}

interface Props {
  contact: Contact
  open: boolean
  onClose: () => void
}

export function EditContactModal({ contact, open, onClose }: Props) {
  const router = useRouter()
  const [form, setForm] = useState({
    full_name: contact.full_name ?? '',
    email: contact.email ?? '',
    phone: contact.phone ?? '',
    company: contact.company ?? '',
    contact_type: (contact.contact_type as string) || 'client',
    notes: contact.notes ?? '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  function handleClose() {
    if (loading) return
    setError(null)
    onClose()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const body = {
        full_name: form.full_name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        company: form.company.trim() || null,
        contact_type: form.contact_type,
        notes: form.notes.trim() || null,
      }
      const res = await fetch(`/api/contacts/${contact.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error ?? `Request failed (${res.status})`)
      }
      router.refresh()
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="Edit Contact" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label="Full Name *">
          <input
            name="full_name"
            type="text"
            required
            value={form.full_name}
            onChange={handleChange}
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

        <FormField label="Notes">
          <textarea
            name="notes"
            rows={3}
            value={form.notes}
            onChange={handleChange}
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
            Save Changes
          </Btn>
        </div>
      </form>
    </Modal>
  )
}
