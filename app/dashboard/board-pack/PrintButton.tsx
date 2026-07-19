'use client'

import { Printer } from 'lucide-react'

/** Opens the browser print dialog — the board pack is print-styled, so this
 *  yields a clean "Save as PDF" without a server-side PDF pipeline. */
export function PrintButton({ label = 'Print / Save PDF' }: { label?: string }) {
  return (
    <button type="button" onClick={() => window.print()}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium"
      style={{ background: 'var(--indigo)', color: '#fff' }}>
      <Printer className="w-3.5 h-3.5" />
      {label}
    </button>
  )
}
