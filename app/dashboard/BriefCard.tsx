'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Sparkles, ChevronDown, ArrowRight } from 'lucide-react'
import type { Watchout } from '@/lib/brief/watchouts'

/**
 * The morning brief. Top: the money risks this week (calculated by the app, each
 * with its own link — a to-do list, not prose). Below: Langa's narrative,
 * generated nightly by the dailyBrief Inngest worker, collapsed so the Pulse
 * stays scannable but the full text is one tap away.
 */
export function BriefCard({ text, generatedAt, watchouts = [] }: { text: string; generatedAt: string; watchouts?: Watchout[] }) {
  const [open, setOpen] = useState(false)
  const when = new Date(generatedAt).toLocaleDateString('en-ZA', { timeZone: 'Africa/Johannesburg', day: 'numeric', month: 'short' })

  return (
    <div className="mt-3 rounded-xl overflow-hidden" style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid var(--border)' }}>
      <div className="flex items-center gap-2 px-4 py-2.5">
        <Sparkles className="w-4 h-4 shrink-0" style={{ color: 'var(--indigo-light)' }} />
        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          {watchouts.length ? 'Watch this week' : 'Langa’s brief'}
        </span>
        <span className="text-xs" style={{ color: 'var(--text-dim)' }}>· {when} · estimates</span>
      </div>

      {watchouts.length > 0 && (
        <ul className="px-2 pb-2 space-y-1">
          {watchouts.map((w) => (
            <li key={w.id}>
              <Link
                href={w.href}
                className="flex items-center gap-3 rounded-lg px-2 py-2.5 min-h-[44px] hover:bg-white/5 focus-visible:outline focus-visible:outline-2"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{w.title}</span>
                  <span className="block text-xs" style={{ color: 'var(--text-muted)' }}>{w.detail}</span>
                </span>
                <span className="shrink-0 inline-flex items-center gap-1 text-xs font-medium" style={{ color: 'var(--indigo-light)' }}>
                  {w.actionLabel} <ArrowRight className="w-3.5 h-3.5" aria-hidden />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {text && (
        <>
          <button
            onClick={() => setOpen(o => !o)}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-left min-h-[44px]"
            style={{ borderTop: watchouts.length ? '1px solid var(--border)' : undefined }}
            aria-expanded={open}
          >
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{watchouts.length ? 'Langa’s full brief' : 'Read the brief'}</span>
            <ChevronDown className={`w-4 h-4 ml-auto transition-transform ${open ? 'rotate-180' : ''}`} style={{ color: 'var(--text-muted)' }} />
          </button>
          {open && (
            <div className="px-4 pb-4 pt-1 text-sm whitespace-pre-wrap leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {text}
            </div>
          )}
        </>
      )}
    </div>
  )
}
