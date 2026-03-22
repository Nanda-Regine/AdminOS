'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

const STORAGE_KEY = 'adminos_cookie_consent'

export function CookieConsent() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const consent = localStorage.getItem(STORAGE_KEY)
    if (!consent) {
      // Small delay to avoid layout shift on first paint
      const timer = setTimeout(() => setVisible(true), 1200)
      return () => clearTimeout(timer)
    }
  }, [])

  function accept() {
    localStorage.setItem(STORAGE_KEY, 'accepted')
    setVisible(false)
  }

  function decline() {
    localStorage.setItem(STORAGE_KEY, 'declined')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      aria-live="polite"
      className="fixed bottom-0 left-0 right-0 z-50 p-4 md:p-6 md:bottom-4 md:left-4 md:right-auto md:max-w-sm"
    >
      <div className="bg-gray-900 border border-white/10 rounded-2xl p-5 shadow-2xl shadow-black/60">
        <p className="text-sm font-semibold text-white mb-1">We use cookies 🍪</p>
        <p className="text-xs text-gray-400 leading-relaxed mb-4">
          AdminOS uses strictly necessary cookies for authentication, and optional analytics
          cookies (Vercel Analytics) to improve the product. No advertising or third-party
          tracking.{' '}
          <Link href="/privacy#cookies" className="text-emerald-400 hover:underline">
            Learn more
          </Link>
        </p>
        <div className="flex gap-2">
          <button
            onClick={accept}
            className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition-colors"
          >
            Accept all
          </button>
          <button
            onClick={decline}
            className="flex-1 border border-white/15 text-gray-400 hover:text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition-colors hover:bg-white/5"
          >
            Necessary only
          </button>
        </div>
      </div>
    </div>
  )
}
