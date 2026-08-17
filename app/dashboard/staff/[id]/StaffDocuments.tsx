'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, Plus } from 'lucide-react'
import { Modal, FormField, inputCls, inputSty, Btn } from '@/components/ui/modal'

interface Document {
  id:         string
  title:      string
  file_url:   string
  file_type:  string | null
  expires_at: string | null
  created_at: string
}

const EMPTY = { title: '', fileUrl: '', fileType: '', expiresAt: '' }

export function StaffDocuments({ staffId, documents }: { staffId: string; documents: Document[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  function handleOpen() { setForm(EMPTY); setError(null); setOpen(true) }
  function handleClose() { if (!loading) setOpen(false) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const body = {
        title:      form.title.trim(),
        file_url:   form.fileUrl.trim(),
        file_type:  form.fileType.trim() || undefined,
        expires_at: form.expiresAt ? new Date(form.expiresAt).toISOString() : undefined,
      }
      const res = await fetch(`/api/staff/${staffId}/documents`, {
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
    <div className="glass rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4" style={{ color: 'var(--indigo-light)' }} />
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Documents ({documents.length})
          </h3>
        </div>
        <button type="button" onClick={handleOpen}
          className="inline-flex items-center gap-1 text-xs font-medium" style={{ color: 'var(--indigo-light)' }}>
          <Plus className="w-3.5 h-3.5" /> Add
        </button>
      </div>

      {documents.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            No documents on file — contracts, ID copies, certifications.
          </p>
        </div>
      ) : (
        <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
          {documents.map(doc => {
            const expired = doc.expires_at ? new Date(doc.expires_at) < new Date() : false
            return (
              <a key={doc.id} href={doc.file_url} target="_blank" rel="noopener noreferrer"
                className="px-5 py-3.5 flex items-center justify-between hover:bg-[var(--surface-hover)] transition-colors">
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{doc.title}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {doc.file_type ? `${doc.file_type} · ` : ''}Added {new Date(doc.created_at).toLocaleDateString('en-ZA')}
                  </p>
                </div>
                {doc.expires_at && (
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{
                      background: expired ? 'rgba(239,68,68,0.15)' : 'rgba(148,163,184,0.12)',
                      color: expired ? '#F87171' : 'var(--text-dim)',
                    }}>
                    {expired ? 'Expired' : `Expires ${new Date(doc.expires_at).toLocaleDateString('en-ZA')}`}
                  </span>
                )}
              </a>
            )
          })}
        </div>
      )}

      <Modal open={open} onClose={handleClose} title="Add Document" size="md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField label="Title *">
            <input name="title" type="text" required value={form.title} onChange={handleChange}
              placeholder="e.g. Signed employment contract" className={inputCls} style={inputSty} />
          </FormField>

          <FormField label="Link *" hint="Paste a link to where the file already lives (Drive, Dropbox, etc.)">
            <input name="fileUrl" type="url" required value={form.fileUrl} onChange={handleChange}
              placeholder="https://…" className={inputCls} style={inputSty} />
          </FormField>

          <FormField label="Type">
            <input name="fileType" type="text" value={form.fileType} onChange={handleChange}
              placeholder="e.g. contract, id, certification" className={inputCls} style={inputSty} />
          </FormField>

          <FormField label="Expires" hint="Optional — for licences, permits, certifications">
            <input name="expiresAt" type="date" value={form.expiresAt} onChange={handleChange}
              className={inputCls} style={inputSty} />
          </FormField>

          {error && (
            <p className="text-sm text-red-400 rounded-lg px-3 py-2" style={{ background: 'rgba(239,68,68,0.1)' }}>
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <Btn variant="ghost" onClick={handleClose} type="button">Cancel</Btn>
            <Btn type="submit" loading={loading}>Add Document</Btn>
          </div>
        </form>
      </Modal>
    </div>
  )
}
