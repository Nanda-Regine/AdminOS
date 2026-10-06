'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

export const CONSENT_STORAGE_KEY = 'adminos_cookie_consent'
const STORAGE_KEY = CONSENT_STORAGE_KEY
/** Fired on window when the visitor makes or changes their choice. */
export const CONSENT_EVENT = 'adminos-consent'

export function CookieConsent() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    let consent: string | null = null
    try { consent = localStorage.getItem(STORAGE_KEY) } catch { /* private mode */ }
    if (!consent) {
      // Small delay to avoid layout shift on first paint
      const timer = setTimeout(() => setVisible(true), 1200)
      return () => clearTimeout(timer)
    }
  }, [])

  function accept() {
    try { localStorage.setItem(STORAGE_KEY, 'accepted') } catch { /* private mode */ }
    window.dispatchEvent(new Event(CONSENT_EVENT))
    setVisible(false)
  }

  function decline() {
    try { localStorage.setItem(STORAGE_KEY, 'declined') } catch { /* private mode */ }
    window.dispatchEvent(new Event(CONSENT_EVENT))
    setVisible(false)
  }

  if (!visible) return null

  // pr-20 on mobile only: the feedback widget is a 44px fixed button at
  // right:12px/bottom:12px with a near-max z-index, so a full-bleed banner put
  // its own buttons underneath it. Reserving the gutter is simpler than
  // fighting the stacking order.
  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      aria-live="polite"
      className="fixed bottom-0 left-0 right-0 z-50 p-4 pr-20 md:p-6 md:pr-6 md:bottom-4 md:left-4 md:right-auto md:max-w-sm"
    >
      <div className="bg-gray-900 border border-white/10 rounded-2xl p-5 shadow-2xl shadow-black/60">
        <p className="text-sm font-semibold text-white mb-1">We use cookies 🍪</p>
        <p className="text-xs text-gray-400 leading-relaxed mb-4">
          AdminOS uses strictly necessary cookies to keep you signed in. With your permission we
          also use product analytics (PostHog, processed in the United States) to see which
          screens work and to catch errors. We never sell data or run advertising trackers.{' '}
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
