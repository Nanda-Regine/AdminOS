'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  /** GET endpoint to hit — e.g. '/api/valuation?refresh=true'. */
  endpoint: string
  label: string
  loadingLabel?: string
  className?: string
}

/**
 * Small "recalculate now" trigger used on pages backed by a cached GET route
 * (valuation, health score, …): fetch, then router.refresh() to re-render the
 * server component with the new snapshot. Surfaces a real error message
 * instead of just stopping the spinner — a fetch that fails on a 401/500
 * with no feedback reads as "nothing happened" and is unrecoverable during a
 * live demo with no console open.
 */
export function RefreshButton({ endpoint, label, loadingLabel = 'Calculating…', className }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(endpoint)
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
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className={className ?? 'px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors'}
      >
        {loading ? loadingLabel : label}
      </button>
      {error && <span className="text-xs text-red-400">{error}</span>}
    </span>
  )
}
