'use client'

import { useState } from 'react'

export function SurveyForm({ token, business }: { token: string; business: string }) {
  const [score, setScore] = useState<number | null>(null)
  const [comment, setComment] = useState('')
  const [state, setState] = useState<'idle' | 'saving' | 'done'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (score === null) return
    setState('saving')
    setError(null)
    try {
      const res = await fetch(`/api/survey/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score, comment: comment.trim() || undefined }),
      })
      if (res.ok) { setState('done'); return }
      setError(((await res.json().catch(() => ({}))) as { error?: string }).error ?? 'Something went wrong. Please try again.')
    } catch {
      setError('No connection. Please try again.')
    }
    setState('idle')
  }

  if (state === 'done') {
    return <p className="text-sm text-white/80">Thank you! {business} has received your feedback.</p>
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <div className="grid grid-cols-6 sm:grid-cols-11 gap-1.5" role="radiogroup" aria-label="Score from 0 to 10">
          {Array.from({ length: 11 }, (_, n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={score === n}
              onClick={() => setScore(n)}
              className={`h-10 rounded-lg text-sm font-semibold border transition-colors ${
                score === n ? 'bg-indigo-500 border-indigo-400 text-white' : 'bg-white/5 border-white/10 text-white/80 hover:bg-white/10'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="flex justify-between text-[11px] text-white/40 mt-1.5">
          <span>Not likely</span><span>Very likely</span>
        </div>
      </div>
      <label className="block">
        <span className="text-xs text-white/60">Anything you&apos;d like to add? (optional)</span>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          maxLength={2000}
          rows={3}
          className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-white outline-none focus:border-indigo-400"
        />
      </label>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={score === null || state === 'saving'}
        className="w-full py-2.5 rounded-xl bg-indigo-500 text-white text-sm font-semibold disabled:opacity-40"
      >
        {state === 'saving' ? 'Sending…' : 'Send'}
      </button>
    </form>
  )
}
