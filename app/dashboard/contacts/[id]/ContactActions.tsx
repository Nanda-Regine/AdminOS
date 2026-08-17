'use client'

import { useState } from 'react'
import { Edit, Send } from 'lucide-react'
import { EditContactModal } from './EditContactModal'

interface Contact {
  id: string
  full_name: string | null
  email: string | null
  phone: string | null
  company: string | null
  contact_type: string | null
  notes: string | null
}

export function ContactActions({ contact }: { contact: Contact }) {
  const [editOpen, setEditOpen] = useState(false)

  return (
    <>
      <div className="flex gap-2 mb-6">
        {contact.phone && (
          <a href={`https://wa.me/${contact.phone.replace(/\D/g, '')}`}
            target="_blank" rel="noopener noreferrer"
            className="flex-1 inline-flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-medium transition-all"
            style={{ background: 'var(--indigo)', color: '#fff' }}>
            <Send className="w-3.5 h-3.5" />
            Message
          </a>
        )}
        <button
          type="button"
          onClick={() => setEditOpen(true)}
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
          <Edit className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
        </button>
      </div>

      <EditContactModal contact={contact} open={editOpen} onClose={() => setEditOpen(false)} />
    </>
  )
}
