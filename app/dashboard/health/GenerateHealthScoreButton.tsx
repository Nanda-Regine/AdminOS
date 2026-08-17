'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function GenerateHealthScoreButton({ label = 'Generate Now' }: { label?: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setLoading(true)
    try {
      const res = await fetch('/api/health-score?refresh=true')
      if (res.ok) router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors"
    >
      {loading ? 'Calculating…' : label}
    </button>
  )
}
