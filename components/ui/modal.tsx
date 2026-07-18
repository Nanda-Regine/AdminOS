'use client'

import { useEffect, useRef } from 'react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
}

export function Modal({ open, onClose, title, children, size = 'md' }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open) { if (!dialog.open) dialog.showModal() }
    else { if (dialog.open) dialog.close() }
  }, [open])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const handleClose = () => onClose()
    dialog.addEventListener('close', handleClose)
    return () => dialog.removeEventListener('close', handleClose)
  }, [onClose])

  const sizeClass = size === 'lg' ? 'max-w-2xl' : size === 'sm' ? 'max-w-sm' : 'max-w-lg'

  return (
    <dialog
      ref={dialogRef}
      className={`${sizeClass} w-full rounded-2xl border shadow-2xl p-0 m-auto max-h-[90vh] overflow-y-auto`}
      style={{
        backgroundColor: 'var(--navy-800)',
        backgroundImage: 'var(--modal-scrim), var(--modal-image)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        borderColor: 'var(--border-hover)',
      }}
    >
      <style>{`dialog::backdrop { background: rgba(0,0,0,0.65); backdrop-filter: blur(4px); }`}</style>
      <div
        className="flex items-center justify-between px-5 py-4 border-b sticky top-0 z-10"
        style={{ background: 'var(--surface-1)', borderColor: 'var(--border)' }}
      >
        <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 transition-colors hover:bg-white/10"
          style={{ color: 'var(--text-muted)' }}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="p-5">{children}</div>
    </dialog>
  )
}

export function FormField({ label, children, hint }: {
  label: string; children: React.ReactNode; hint?: string
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
        {label}
      </label>
      {children}
      {hint && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{hint}</p>}
    </div>
  )
}

export const inputCls = [
  'w-full rounded-lg px-3 py-2.5 text-sm border transition-colors',
  'focus:outline-none focus:ring-2 focus:ring-indigo-500',
].join(' ')

export const inputSty: React.CSSProperties = {
  background: 'var(--surface-2)',
  borderColor: 'var(--border)',
  color: 'var(--text-primary)',
}

export function Btn({ children, loading, type = 'button', onClick, variant = 'primary' }: {
  children: React.ReactNode; loading?: boolean; type?: 'button' | 'submit'
  onClick?: () => void; variant?: 'primary' | 'ghost'
}) {
  if (variant === 'ghost') return (
    <button type={type} onClick={onClick}
      className="px-4 py-2.5 rounded-xl text-sm font-medium transition-colors hover:bg-white/10"
      style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
      {children}
    </button>
  )
  return (
    <button type={type} onClick={onClick} disabled={loading}
      className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition-colors flex items-center gap-2">
      {loading && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
      {children}
    </button>
  )
}
