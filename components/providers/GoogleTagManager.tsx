'use client'

import { useEffect } from 'react'
import { CONSENT_EVENT, CONSENT_STORAGE_KEY } from '@/components/CookieConsent'

const GTM_ID = 'GTM-TW233HZH'

function consentGiven(): boolean {
  try { return localStorage.getItem(CONSENT_STORAGE_KEY) === 'accepted' } catch { return false }
}

/**
 * Google Tag Manager, loaded only after "Accept all" on the cookie banner.
 * Same POPIA rule as PostHogAnalytics: tags are optional processing and a
 * cross-border transfer, so nothing loads before the visitor opts in. There is
 * deliberately no <noscript> iframe — it cannot wait for consent.
 */
export function GoogleTagManager() {
  useEffect(() => {
    const load = () => {
      if (!consentGiven() || document.getElementById('gtm-script')) return
      const w = window as unknown as { dataLayer?: unknown[] }
      w.dataLayer = w.dataLayer || []
      w.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' })
      const s = document.createElement('script')
      s.id = 'gtm-script'
      s.async = true
      s.src = `https://www.googletagmanager.com/gtm.js?id=${GTM_ID}`
      document.head.appendChild(s)
    }
    load()
    window.addEventListener(CONSENT_EVENT, load)
    return () => window.removeEventListener(CONSENT_EVENT, load)
  }, [])
  return null
}
