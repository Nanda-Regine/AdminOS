'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { UserPlus, Loader2 } from 'lucide-react'

// Put one person into a sequence by phone number. The server checks POPIA
// s69 (consent or customer, not opted out) and duplicate enrolment, and says
// which in plain words if it refuses.
export function EnrolButton({ sequenceId, disabled }: { sequenceId: string; disabled?: boolean }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [phone, setPhone] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!phone.trim()) return
    setBusy(true)
    setMsg(null)
    try {
      const res = await fetch(`/api/sequences/${sequenceId}/enroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim() }),
      })
      const data = await res.json().catch(() => ({})) as { error?: string }
      if (res.ok) {
        setMsg({ ok: true, text: 'Enrolled' })
        setPhone('')
        router.refresh()
      } else {
        setMsg({ ok: false, text: data.error ?? 'Could not enrol' })
      }
    } catch {
      setMsg({ ok: false, text: 'Network error' })
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        disabled={disabled}
        title={disabled ? 'Turn the sequence on first' : undefined}
        className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg disabled:opacity-40"
        style={{ background: 'var(--indigo-muted)', color: 'var(--indigo-light)' }}
      >
        <UserPlus className="w-3 h-3" /> Enrol
      </button>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-1 max-w-[14rem]">
      <div className="flex gap-1">
        <input
          autoFocus
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="082 123 4567"
          className="w-full min-w-0 px-2 py-1 rounded-lg text-xs outline-none"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
        />
        <button type="submit" disabled={busy || !phone.trim()} className="text-xs px-2 py-1 rounded-lg disabled:opacity-50"
          style={{ background: 'var(--indigo)', color: '#fff' }}>
          {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Add'}
        </button>
        <button type="button" onClick={() => { setOpen(false); setMsg(null) }} className="text-xs px-1" style={{ color: 'var(--text-muted)' }}>
          ✕
        </button>
      </div>
      {msg && <p className="text-xs" style={{ color: msg.ok ? '#22C55E' : '#EF4444' }}>{msg.text}</p>}
    </form>
  )
}
