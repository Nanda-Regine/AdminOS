'use client'

import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'

type Theme = 'dark' | 'light'

/**
 * Flips the whole app between the dark and light token sets by toggling
 * data-theme on <html>. The choice persists in localStorage and is applied
 * before paint by the inline script in the root layout (no flash).
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('dark')

  useEffect(() => {
    const current = (document.documentElement.getAttribute('data-theme') as Theme) || 'dark'
    setTheme(current)
  }, [])

  function toggle() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.setAttribute('data-theme', next)
    try { localStorage.setItem('adminos-theme', next) } catch { /* private mode */ }
  }

  const goingLight = theme === 'dark'

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={goingLight ? 'Switch to light mode' : 'Switch to dark mode'}
      className="flex items-center gap-2 text-sm transition-colors w-full"
      style={{ color: 'var(--text-muted)' }}
      onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)')}
      onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'var(--text-muted)')}
    >
      {goingLight ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      {goingLight ? 'Light mode' : 'Dark mode'}
    </button>
  )
}
