'use client'

import { useState } from 'react'
import { Sparkles, ChevronDown } from 'lucide-react'

/**
 * Surfaces the Langa-authored morning brief (generated nightly by the
 * dailyBrief Inngest worker, cached to Redis). Collapsible so the Pulse stays
 * scannable but the full narrative is one tap away.
 */
export function BriefCard({ text, generatedAt }: { text: string; generatedAt: string }) {
  const [open, setOpen] = useState(false)
  const when = new Date(generatedAt).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })

  return (
    <div className="mt-3 rounded-xl overflow-hidden" style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid var(--border)' }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-left"
        aria-expanded={open}
      >
        <Sparkles className="w-4 h-4 shrink-0" style={{ color: 'var(--indigo-light)' }} />
        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Langa&apos;s brief</span>
        <span className="text-xs" style={{ color: 'var(--text-dim)' }}>· {when}</span>
        <ChevronDown className={`w-4 h-4 ml-auto transition-transform ${open ? 'rotate-180' : ''}`} style={{ color: 'var(--text-muted)' }} />
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 text-sm whitespace-pre-wrap leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          {text}
        </div>
      )}
    </div>
  )
}
