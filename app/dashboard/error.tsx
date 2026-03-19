'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[AdminOS] Dashboard error:', error)
  }, [error])

  return (
    <div className="flex flex-1 items-center justify-center p-12">
      <div className="text-center max-w-sm">
        <p className="text-4xl mb-4">🔌</p>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Page failed to load</h2>
        <p className="text-sm text-gray-500 mb-6">
          This could be a brief Supabase hiccup or a network issue. Your data is safe — just try again.
        </p>
        {error.digest && (
          <p className="text-xs text-gray-400 mb-4 font-mono">Ref: {error.digest}</p>
        )}
        <Button onClick={reset}>Reload page</Button>
      </div>
    </div>
  )
}
