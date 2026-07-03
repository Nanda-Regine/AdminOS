'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

// Cancel a single add-on. Posts to /api/billing/addons/cancel, which scopes the Paystack
// cancel to this add-on's plan only (never the plan or other add-ons).
export function CancelAddonButton({ slug }: { slug: string }) {
  const router = useRouter()
  const [state, setState] = useState<'idle' | 'confirm' | 'working' | 'error'>('idle')
  const [msg, setMsg] = useState('')

  async function cancel() {
    setState('working')
    setMsg('')
    try {
      const res = await fetch('/api/billing/addons/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug }),
      })
      const body = await res.json().catch(() => ({}))
      if (res.ok && body.success) {
        router.refresh() // the add-on card re-renders as inactive
      } else {
        setState('error')
        setMsg(body.error || 'Could not cancel. Please try again.')
      }
    } catch {
      setState('error')
      setMsg('Could not reach the billing service.')
    }
  }

  if (state === 'confirm') {
    return (
      <div className="flex gap-2 mt-2">
        <button
          onClick={cancel}
          className="flex-1 py-2 text-center text-xs font-semibold rounded-xl"
          style={{ background: '#EF444420', color: '#EF4444', border: '1px solid #EF444430' }}
        >
          Yes, cancel
        </button>
        <button
          onClick={() => setState('idle')}
          className="flex-1 py-2 text-center text-xs font-semibold rounded-xl"
          style={{ background: 'var(--surface-2)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
        >
          Keep
        </button>
      </div>
    )
  }

  return (
    <div className="mt-2">
      {state === 'error' && (
        <p className="text-xs mb-1" style={{ color: '#EF4444' }}>{msg}</p>
      )}
      <button
        onClick={() => { setState('confirm'); setMsg('') }}
        disabled={state === 'working'}
        className="w-full text-xs font-medium underline disabled:opacity-60"
        style={{ color: 'var(--text-muted)' }}
      >
        {state === 'working' ? 'Cancelling…' : 'Cancel add-on'}
      </button>
    </div>
  )
}
