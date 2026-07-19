'use client'

import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'

type Variant = 'primary' | 'danger'

interface ConfirmSubmitProps {
  /** Visible trigger label, e.g. "Distribute". */
  label: string
  /** Dialog heading, e.g. "Distribute payslips?". */
  title: string
  /** Dialog body — say exactly what will happen and that it can't be undone. */
  description: string
  /** Confirm-button label. Defaults to the trigger label. */
  confirmLabel?: string
  variant?: Variant
  /** Extra classes for the trigger (so it can match its neighbours). */
  className?: string
}

/**
 * Guards a native <form method="POST"> submit behind a confirmation dialog with a
 * pending state. Drop it inside the form in place of the plain submit button —
 * it finds its enclosing form and submits only after the user confirms.
 */
export function ConfirmSubmit({
  label, title, description, confirmLabel, variant = 'primary', className = '',
}: ConfirmSubmitProps) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    confirmRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  function confirm() {
    const form = triggerRef.current?.closest('form')
    if (!form) return
    setPending(true)
    form.requestSubmit()
  }

  const accent = variant === 'danger' ? 'var(--danger)' : 'var(--indigo)'

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        className={className || 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors'}
        style={className ? undefined : { background: accent, color: '#fff' }}
      >
        {label}
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(4,6,20,0.7)', backdropFilter: 'blur(4px)' }}
          onClick={(e) => { if (e.target === e.currentTarget && !pending) setOpen(false) }}
        >
          <div
            className="w-full max-w-sm rounded-2xl p-6 text-left"
            style={{ backgroundColor: 'var(--navy-800)', backgroundImage: 'var(--modal-scrim), var(--modal-image)', backgroundSize: 'cover', backgroundPosition: 'center', border: '1px solid var(--border-hover)' }}
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: variant === 'danger' ? 'rgba(239,68,68,0.15)' : 'var(--indigo-muted)' }}>
                <AlertTriangle className="w-5 h-5" style={{ color: accent }} />
              </div>
              <div>
                <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h3>
                <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{description}</p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
              >
                Cancel
              </button>
              <button
                ref={confirmRef}
                type="button"
                onClick={confirm}
                disabled={pending}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-60"
                style={{ background: accent }}
              >
                {pending && <Loader2 className="w-4 h-4 animate-spin" />}
                {confirmLabel || label}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
