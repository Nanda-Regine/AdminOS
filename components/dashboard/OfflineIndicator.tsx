'use client'

import { useEffect, useState } from 'react'
import { WifiOff } from 'lucide-react'

/**
 * Shows an "offline" pill when the browser loses connectivity — important in the
 * SA load-shedding context. Pure client (navigator.onLine + online/offline
 * events); no service-worker interaction, so zero caching risk. Cached pages
 * still render offline via the PWA; this just tells the owner what's happening.
 */
export function OfflineIndicator() {
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine)
    update()
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])

  if (!offline) return null

  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium"
      style={{ background: 'rgba(245,158,11,0.15)', color: '#FBBF24', border: '1px solid rgba(245,158,11,0.3)' }}
      title="You're offline. Cached pages still work; changes will sync when you're back online."
    >
      <WifiOff className="w-3.5 h-3.5" />
      <span className="hidden sm:inline">Offline</span>
    </span>
  )
}
