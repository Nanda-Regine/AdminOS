'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  endpoint: string
  method?: 'PATCH' | 'POST' | 'DELETE'
  body?: Record<string, unknown>
  label: string
  loadingLabel?: string
  /** Ask first — for actions that are hard to undo. */
  confirmText?: string
  className?: string
}

/** One-tap row action: call the API, then re-render the server page. Shows the real error on failure. */
export function ActionButton({ endpoint, method = 'PATCH', body, label, loadingLabel = 'Saving…', confirmText, className }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run() {
    if (confirmText && !window.confirm(confirmText)) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(endpoint, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error ?? `Request failed (${res.status})`)
      }
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong — try again')
    } finally {
      setLoading(false)
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={run}
        disabled={loading}
        className={className ?? 'min-h-[44px] px-3 rounded-lg border border-[var(--border)] text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] disabled:opacity-50'}
      >
        {loading ? loadingLabel : label}
      </button>
      {error && <span role="alert" className="text-xs text-red-400">{error}</span>}
    </span>
  )
}
