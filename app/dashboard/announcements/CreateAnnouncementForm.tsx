'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

// Posts JSON to /api/announcements (audience/pinned/expiresAt) — the previous
// native <form> sent form-encoded data with fields (priority/target_roles) the
// JSON API doesn't accept, so publishing never worked.
export function CreateAnnouncementForm() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [audience, setAudience] = useState<'all' | 'managers'>('all')
  const [pinned, setPinned] = useState(false)
  const [expiresAt, setExpiresAt] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!title.trim() || !body.trim()) { setError('Title and message are required.'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          audience,
          pinned,
          // Send an ISO datetime (API expects z.string().datetime()); date input is YYYY-MM-DD.
          expiresAt: expiresAt ? new Date(expiresAt + 'T23:59:59Z').toISOString() : undefined,
        }),
      })
      if (!res.ok) {
        const b = await res.json().catch(() => ({}))
        throw new Error(b?.error || `Error ${res.status}`)
      }
      setTitle(''); setBody(''); setAudience('all'); setPinned(false); setExpiresAt('')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  const field = 'w-full px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--indigo)]'
  const fieldStyle = { background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Title</label>
        <input value={title} onChange={e => setTitle(e.target.value)} required placeholder="Announcement title…" className={field} style={fieldStyle} />
      </div>
      <div>
        <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Message</label>
        <textarea value={body} onChange={e => setBody(e.target.value)} required rows={4} placeholder="Write your announcement here…" className={`${field} resize-none`} style={fieldStyle} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Audience</label>
          <select value={audience} onChange={e => setAudience(e.target.value as 'all' | 'managers')} className={field} style={fieldStyle}>
            <option value="all">All staff</option>
            <option value="managers">Managers only</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Expires (optional)</label>
          <input type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} className={field} style={fieldStyle} />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--text-secondary)' }}>
        <input type="checkbox" checked={pinned} onChange={e => setPinned(e.target.checked)} className="w-4 h-4 rounded accent-indigo-600 cursor-pointer" />
        Pin to top
      </label>
      {error && (
        <p className="text-sm rounded-lg px-3 py-2" style={{ color: '#F87171', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)' }}>{error}</p>
      )}
      <div className="flex justify-end">
        <button type="submit" disabled={loading} className="bg-[var(--indigo)] text-white text-sm font-semibold px-5 py-2 rounded-lg hover:bg-[var(--indigo-light)] transition-colors disabled:opacity-60">
          {loading ? 'Publishing…' : 'Publish Announcement'}
        </button>
      </div>
    </form>
  )
}
