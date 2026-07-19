'use client'

import { useState } from 'react'
import { MessageCircle, MoonStar } from 'lucide-react'

interface Category { key: string; label: string; description: string }

const MIN_OPTS: { v: number; label: string }[] = Array.from({ length: 48 }, (_, i) => {
  const m = i * 30
  const hh = String(Math.floor(m / 60)).padStart(2, '0')
  const mm = String(m % 60).padStart(2, '0')
  return { v: m, label: `${hh}:${mm}` }
})

export function NotificationPreferences({
  categories,
  initialNotify,
  initialQuiet,
}: {
  categories: Category[]
  initialNotify: Record<string, { whatsapp?: boolean }>
  initialQuiet: { start: number; end: number } | null
}) {
  const [notify, setNotify] = useState(initialNotify)
  const [quietOn, setQuietOn] = useState(Boolean(initialQuiet))
  const [quiet, setQuiet] = useState(initialQuiet ?? { start: 21 * 60, end: 6 * 60 })
  const [error, setError] = useState<string | null>(null)

  async function save(payload: object) {
    setError(null)
    try {
      const res = await fetch('/api/settings/notifications', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || 'Could not save')
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save')
      return false
    }
  }

  async function toggleWhatsApp(key: string) {
    const next = notify[key]?.whatsapp === false ? true : false
    const prev = notify
    setNotify(n => ({ ...n, [key]: { ...n[key], whatsapp: next } }))
    if (!(await save({ type: key, whatsapp: next }))) setNotify(prev)
  }

  async function toggleQuiet() {
    const next = !quietOn
    setQuietOn(next)
    if (!(await save({ quietHours: next ? quiet : null }))) setQuietOn(!next)
  }

  async function setWindow(part: 'start' | 'end', v: number) {
    const next = { ...quiet, [part]: v }
    setQuiet(next)
    if (quietOn) await save({ quietHours: next })
  }

  return (
    <div className="space-y-6">
      {error && (
        <p className="text-sm rounded-lg px-3 py-2" style={{ color: '#F87171', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)' }}>{error}</p>
      )}

      {/* WhatsApp per category */}
      <div className="glass rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b flex items-center gap-2" style={{ borderColor: 'var(--border)' }}>
          <MessageCircle className="w-4 h-4" style={{ color: 'var(--indigo-light)' }} />
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>WhatsApp alerts</h3>
        </div>
        <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
          {categories.map(c => {
            const on = notify[c.key]?.whatsapp !== false
            return (
              <div key={c.key} className="flex items-center justify-between gap-4 px-5 py-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{c.label}</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{c.description}</p>
                </div>
                <Toggle on={on} onClick={() => toggleWhatsApp(c.key)} />
              </div>
            )
          })}
        </div>
        <p className="px-5 py-3 text-xs border-t" style={{ color: 'var(--text-dim)', borderColor: 'var(--border)' }}>
          The in-app bell always shows these — this only controls the WhatsApp copy.
        </p>
      </div>

      {/* Quiet hours */}
      <div className="glass rounded-2xl overflow-hidden">
        <div className="px-5 py-4 flex items-center justify-between gap-4">
          <div className="flex items-start gap-2 flex-1 min-w-0">
            <MoonStar className="w-4 h-4 mt-0.5" style={{ color: 'var(--indigo-light)' }} />
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Quiet hours</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Hold WhatsApp messages during these hours (SAST). The bell still updates.</p>
            </div>
          </div>
          <Toggle on={quietOn} onClick={toggleQuiet} />
        </div>
        {quietOn && (
          <div className="px-5 pb-4 flex items-center gap-3 flex-wrap">
            <TimeSelect label="From" value={quiet.start} onChange={v => setWindow('start', v)} />
            <TimeSelect label="To" value={quiet.end} onChange={v => setWindow('end', v)} />
          </div>
        )}
      </div>
    </div>
  )
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="relative w-11 h-6 rounded-full transition-colors shrink-0"
      style={{ background: on ? 'var(--indigo)' : 'var(--surface-2)' }} aria-pressed={on}>
      <span className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform"
        style={{ transform: on ? 'translateX(20px)' : 'translateX(0)' }} />
    </button>
  )
}

function TimeSelect({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
      {label}
      <select value={value} onChange={e => onChange(Number(e.target.value))}
        className="rounded-lg px-2 py-1.5 text-sm" style={{ background: 'var(--surface-2)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>
        {MIN_OPTS.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
      </select>
    </label>
  )
}
