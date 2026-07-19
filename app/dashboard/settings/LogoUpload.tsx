'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, Trash2, Loader2, Check } from 'lucide-react'

/**
 * Business logo upload. Reads the file to a data URL client-side, validates
 * type/size, previews it, and POSTs to /api/settings/logo. The stored logo then
 * appears on payslips, the board pack, and other documents.
 */
export function LogoUpload({ initialLogo }: { initialLogo: string | null }) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [logo, setLogo] = useState<string | null>(initialLogo)
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  function pick() { inputRef.current?.click() }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    if (!/^image\/(png|jpeg|jpg|webp|svg\+xml)$/.test(file.type)) {
      setError('Use a PNG, JPG, WEBP or SVG.'); return
    }
    if (file.size > 300 * 1024) {
      setError('Image is too large — please use one under 300 KB.'); return
    }
    const dataUrl: string = await new Promise((resolve, reject) => {
      const r = new FileReader()
      r.onload = () => resolve(r.result as string)
      r.onerror = reject
      r.readAsDataURL(file)
    })
    setLogo(dataUrl)
    await save(dataUrl)
    if (inputRef.current) inputRef.current.value = ''
  }

  async function save(dataUrl: string) {
    setState('saving')
    try {
      const res = await fetch('/api/settings/logo', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dataUrl }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || 'Upload failed')
      setState('saved'); router.refresh(); setTimeout(() => setState('idle'), 2500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed'); setState('error')
    }
  }

  async function remove() {
    setError(null); setState('saving')
    try {
      const res = await fetch('/api/settings/logo', { method: 'DELETE' })
      if (!res.ok) throw new Error('Could not remove')
      setLogo(null); setState('idle'); router.refresh()
    } catch {
      setError('Could not remove logo'); setState('error')
    }
  }

  return (
    <div className="flex items-center gap-4 flex-wrap">
      <div className="w-20 h-20 rounded-xl flex items-center justify-center overflow-hidden shrink-0"
        style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
        {logo
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={logo} alt="Business logo" className="max-w-full max-h-full object-contain" />
          : <span className="text-xs" style={{ color: 'var(--text-dim)' }}>No logo</span>}
      </div>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={onFile} className="hidden" />
          <button type="button" onClick={pick} disabled={state === 'saving'}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-60"
            style={{ background: 'var(--indigo)', color: '#fff' }}>
            {state === 'saving' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : state === 'saved' ? <Check className="w-3.5 h-3.5" /> : <Upload className="w-3.5 h-3.5" />}
            {logo ? 'Replace logo' : 'Upload logo'}
          </button>
          {logo && (
            <button type="button" onClick={remove} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm"
              style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
              <Trash2 className="w-3.5 h-3.5" /> Remove
            </button>
          )}
        </div>
        <p className="text-xs" style={{ color: error ? '#F87171' : 'var(--text-dim)' }}>
          {error ?? 'PNG, JPG, WEBP or SVG · under 300 KB · shows on payslips, board packs & documents.'}
        </p>
      </div>
    </div>
  )
}
