'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { FEATURES, type FeatureCategory } from '@/lib/nav/features'

/**
 * Sets `data-ground` on <html> from the current route's value-chain category, so
 * the app shell paints that domain's signature texture (see globals.css). Purely
 * decorative — it only swaps a CSS custom property; the scrim keeps text legible.
 * Longest-href-prefix wins, so nested pages inherit their cockpit's ground.
 */
const CATEGORY_GROUND: Record<FeatureCategory, string> = {
  Command:  'command',
  'Get Paid': 'money',
  'Win Work': 'sales',
  Deliver:  'ops',
  Team:     'people',
  Govern:   'govern',
  Grow:     'grow',
  Setup:    'setup',
}

function groundFor(pathname: string): string | null {
  if (pathname === '/dashboard') return CATEGORY_GROUND.Command
  let best: { href: string; category: FeatureCategory } | null = null
  for (const f of FEATURES) {
    if (f.exact) continue // the exact-only home never wins as a prefix
    if (pathname === f.href || pathname.startsWith(f.href + '/')) {
      if (!best || f.href.length > best.href.length) best = f
    }
  }
  return best ? CATEGORY_GROUND[best.category] : null
}

export function DomainGround() {
  const pathname = usePathname()
  useEffect(() => {
    const g = groundFor(pathname || '')
    const root = document.documentElement
    if (g) root.setAttribute('data-ground', g)
    else root.removeAttribute('data-ground')
    return () => root.removeAttribute('data-ground')
  }, [pathname])
  return null
}
