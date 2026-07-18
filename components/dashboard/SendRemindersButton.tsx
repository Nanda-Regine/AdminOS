'use client'

import { useState } from 'react'
import { ArrowRight, Send, Check, Loader2 } from 'lucide-react'

/**
 * Owner-triggered "Send reminders" — POSTs /api/money/remind, which fans the
 * overdue book through the recovery engine (tier gate + content guard intact).
 * Attended action, so it sends even when unattended auto-recovery is off.
 */
export function SendRemindersButton({ label }: { label: string }) {
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const [message, setMessage] = useState('')

  async function send() {
    if (state === 'sending' || state === 'done') return
    setState('sending')
    try {
      const res = await fetch('/api/money/remind', { method: 'POST' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body?.error || 'Could not send reminders')
      setMessage(body?.message ?? 'Reminders queued.')
      setState('done')
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Something went wrong')
      setState('error')
    }
  }

  return (
    <div className="mt-3 flex items-center gap-3 flex-wrap">
      <button
        onClick={send}
        disabled={state === 'sending' || state === 'done'}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-70"
        style={{ background: 'var(--indigo)', color: '#fff' }}
      >
        {state === 'sending' ? <Loader2 className="w-4 h-4 animate-spin" />
          : state === 'done' ? <Check className="w-4 h-4" />
          : <Send className="w-4 h-4" />}
        {state === 'sending' ? 'Sending…' : state === 'done' ? 'Reminders sent' : label}
        {state === 'idle' && <ArrowRight className="w-4 h-4" />}
      </button>
      {message && (
        <span className="text-xs" style={{ color: state === 'error' ? '#F87171' : 'var(--text-muted)' }}>{message}</span>
      )}
    </div>
  )
}
