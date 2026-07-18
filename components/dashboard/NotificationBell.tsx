'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, Check } from 'lucide-react'

interface Note { id: string; type: string; title: string; body: string; read: boolean; action_url: string | null; created_at: string }

const TYPE_DOT: Record<string, string> = {
  'payment.received': '#34D399', 'recovery.escalation': '#F87171', 'recovery.sent': '#818CF8',
  'approval.needed': '#F59E0B', 'booking.reminder': '#38BDF8',
}

export function NotificationBell() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Note[]>([])
  const [unread, setUnread] = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  async function load() {
    try {
      const r = await fetch('/api/notifications', { cache: 'no-store' })
      if (!r.ok) return
      const j = await r.json() as { items: Note[]; unread: number }
      setItems(j.items ?? [])
      setUnread(j.unread ?? 0)
    } catch { /* silent */ }
  }

  useEffect(() => {
    load()
    const iv = setInterval(load, 60000) // gentle poll; realtime toast bar covers instant alerts
    return () => clearInterval(iv)
  }, [])

  useEffect(() => {
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  async function markAll() {
    setUnread(0); setItems(prev => prev.map(n => ({ ...n, read: true })))
    await fetch('/api/notifications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ all: true }) }).catch(() => {})
  }

  async function openNote(n: Note) {
    if (!n.read) {
      setItems(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x))
      setUnread(u => Math.max(0, u - 1))
      fetch('/api/notifications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: n.id }) }).catch(() => {})
    }
    setOpen(false)
    if (n.action_url) router.push(n.action_url)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="relative w-9 h-9 rounded-lg flex items-center justify-center transition-colors hover:bg-[var(--surface-hover)]"
        style={{ color: 'var(--text-muted)' }}
        aria-label={`Notifications${unread ? ` (${unread} unread)` : ''}`}
      >
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full text-[10px] font-bold flex items-center justify-center"
            style={{ background: '#F87171', color: '#fff' }}>{unread > 9 ? '9+' : unread}</span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 rounded-xl overflow-hidden shadow-2xl z-50"
          style={{ background: 'var(--surface-1)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Notifications</p>
            {unread > 0 && (
              <button onClick={markAll} className="text-xs font-medium inline-flex items-center gap-1" style={{ color: 'var(--indigo-light)' }}>
                <Check className="w-3 h-3" /> Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <Bell className="w-6 h-6 mx-auto mb-2" style={{ color: 'var(--text-dim)' }} />
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>You&apos;re all caught up.</p>
              </div>
            ) : (
              items.map(n => (
                <button key={n.id} onClick={() => openNote(n)}
                  className="w-full text-left flex gap-3 px-4 py-3 border-b transition-colors hover:bg-[var(--surface-hover)]"
                  style={{ borderColor: 'var(--border)', background: n.read ? 'transparent' : 'rgba(99,102,241,0.05)' }}>
                  <span className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: n.read ? 'var(--border)' : (TYPE_DOT[n.type] ?? 'var(--indigo-light)') }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{n.title}</p>
                    <p className="text-xs line-clamp-2" style={{ color: 'var(--text-muted)' }}>{n.body}</p>
                    <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-dim)' }}>
                      {new Date(n.created_at).toLocaleString('en-ZA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
