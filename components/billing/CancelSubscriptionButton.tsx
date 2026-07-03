'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle } from 'lucide-react'

// Cancel the tenant's AdminOS subscription. Posts to /api/billing/cancel, which
// derives the tenant from the session and asks the Mirembe hub to disable the
// Paystack subscription. Cancel = won't auto-renew; access lasts until period end.
export function CancelSubscriptionButton() {
  const router = useRouter()
  const [state, setState] = useState<'idle' | 'confirm' | 'working' | 'done' | 'error'>('idle')
  const [msg, setMsg] = useState('')

  async function cancel() {
    setState('working')
    setMsg('')
    try {
      const res = await fetch('/api/billing/cancel', { method: 'POST' })
      const body = await res.json().catch(() => ({}))
      if (res.ok && body.success) {
        setState('done')
        setMsg("Done — your subscription won't renew. You keep your plan until the end of the current billing period.")
        router.refresh()
      } else {
        setState('error')
        setMsg(body.error || 'Could not cancel right now. Please try again or contact support.')
      }
    } catch {
      setState('error')
      setMsg('Could not reach the billing service. Please try again shortly.')
    }
  }

  if (state === 'done') {
    return <p className="text-sm" style={{ color: '#22C55E' }}>{msg}</p>
  }

  if (state === 'confirm') {
    return (
      <div>
        <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
          Cancel your subscription? It won&apos;t auto-renew, and you&apos;ll keep your plan until the end of the current billing period.
        </p>
        <div className="flex gap-2">
          <button
            onClick={cancel}
            className="px-4 py-2 rounded-xl text-sm font-semibold transition-all"
            style={{ background: '#EF4444', color: '#fff' }}
          >
            Yes, cancel
          </button>
          <button
            onClick={() => { setState('idle'); setMsg('') }}
            className="px-4 py-2 rounded-xl text-sm font-semibold transition-all"
            style={{ background: 'var(--surface-2)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
          >
            Keep plan
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      {state === 'error' && (
        <p className="flex items-center gap-1.5 text-sm mb-2" style={{ color: '#EF4444' }}>
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
          {msg}
        </p>
      )}
      <button
        onClick={() => { setState('confirm'); setMsg('') }}
        disabled={state === 'working'}
        className="text-sm font-medium underline disabled:opacity-60"
        style={{ color: 'var(--text-muted)' }}
      >
        {state === 'working' ? 'Cancelling…' : 'Cancel subscription'}
      </button>
    </div>
  )
}
