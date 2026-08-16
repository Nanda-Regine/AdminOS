'use client'

import { NotificationBell } from './NotificationBell'
import { OfflineIndicator } from './OfflineIndicator'

interface TopBarProps {
  title: string
  subtitle?: string
  actions?: React.ReactNode
}

export function TopBar({ title, subtitle, actions }: TopBarProps) {
  return (
    <header
      className="flex items-center justify-between pl-16 pr-4 md:px-6 border-b shrink-0 sticky top-0 z-20"
      style={{
        height: 'var(--topbar-h)',
        background: 'var(--topbar-bg)',
        borderColor: 'var(--border)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}
    >
      {/* min-w-0 + truncate: a flex child defaults to min-width:auto and refuses
          to shrink below its content, so a long subtitle (governance runs ~380px)
          pushed the actions clean off a 360px screen. shrink-0 keeps the bell and
          offline chip pinned regardless of title length. */}
      <div className="min-w-0 flex-1">
        <h1 className="text-base font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{title}</h1>
        {subtitle && <p className="text-xs truncate hidden sm:block" style={{ color: 'var(--text-muted)' }}>{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2 shrink-0 ml-2">
        <OfflineIndicator />
        {actions}
        <NotificationBell />
      </div>
    </header>
  )
}
