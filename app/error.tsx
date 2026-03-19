'use client'

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[AdminOS] Global error:', error)
  }, [error])

  return (
    <html lang="en-ZA">
      <body>
        <div className="flex min-h-screen items-center justify-center p-8 bg-gray-50">
          <div className="text-center max-w-md">
            <p className="text-5xl mb-4">⚠️</p>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Something went wrong</h2>
            <p className="text-sm text-gray-500 mb-1">
              AdminOS encountered an unexpected error. Your data is safe.
            </p>
            {error.digest && (
              <p className="text-xs text-gray-400 mb-4 font-mono">Ref: {error.digest}</p>
            )}
            <button
              onClick={reset}
              className="mt-4 px-5 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
