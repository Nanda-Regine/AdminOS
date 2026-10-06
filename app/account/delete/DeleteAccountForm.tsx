'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export function DeleteAccountForm({ email }: { email: string }) {
  const [confirm, setConfirm] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (confirm !== 'DELETE' || busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm, reason: reason.trim() || undefined, source: 'web' }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error ?? `Error ${res.status}`)
      await createClient().auth.signOut().catch(() => undefined)
      setDone(new Date(body.purgeAfter).toLocaleDateString('en-ZA', { timeZone: 'Africa/Johannesburg', day: 'numeric', month: 'long', year: 'numeric' }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <p className="text-emerald-300">
        Your login has been disabled and you have been signed out. It will be permanently anonymised on {done}.
      </p>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <p>Signed in as <strong className="text-white">{email}</strong>.</p>
      <label className="block space-y-1">
        <span className="text-sm">Why are you leaving? (optional)</span>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={1000}
          rows={3}
          className="w-full rounded-lg bg-black/30 border border-white/15 px-3 py-2 text-white"
        />
      </label>
      <label className="block space-y-1">
        <span className="text-sm">Type <strong className="text-white">DELETE</strong> to confirm</span>
        <input
          value={confirm}
          onChange={(e) => setConfirm(e.target.value.toUpperCase())}
          autoComplete="off"
          className="w-full rounded-lg bg-black/30 border border-white/15 px-3 py-2 text-white tracking-widest"
        />
      </label>
      {error && <p role="alert" className="text-red-400 text-sm">{error}</p>}
      <button
        type="submit"
        disabled={confirm !== 'DELETE' || busy}
        className="rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-40 px-4 py-2 font-semibold text-white"
      >
        {busy ? 'Deleting…' : 'Delete my account'}
      </button>
    </form>
  )
}
