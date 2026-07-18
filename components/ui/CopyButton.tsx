'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

/** Small inline "copy to clipboard" button with a transient confirmed state. */
export function CopyButton({ value, label = 'Copy', className = '' }: { value: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard unavailable (insecure context) — no-op */
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? 'Copied' : `${label} ${value}`}
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors ${className}`}
      style={{
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        color: copied ? '#34D399' : 'var(--text-secondary)',
      }}
    >
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {copied ? 'Copied' : label}
    </button>
  )
}
