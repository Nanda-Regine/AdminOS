'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { useOpenOnParam } from '@/lib/hooks/useOpenOnParam'

const FIELD =
  'w-full rounded-lg px-3 py-2.5 text-sm min-h-[44px] bg-[var(--surface-2)] ' +
  'border border-[var(--border)] text-[var(--text-primary)] ' +
  'placeholder:text-[var(--text-dim)] focus:outline-none focus:ring-2 focus:ring-[var(--indigo)]'
const LABEL = 'block text-xs font-medium mb-1 text-[var(--text-secondary)]'

export function AddSupplierModal() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useOpenOnParam('new', () => setOpen(true))

  function close() {
    setOpen(false)
    setError(null)
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const fd = new FormData(e.currentTarget)
    const str = (k: string) => {
      const v = (fd.get(k) as string | null)?.trim()
      return v ? v : undefined
    }
    const level = str('bbbbeeLlevel')

    try {
      const res = await fetch('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:          str('name'),
          category:      str('category'),
          phone:         str('phone'),
          email:         str('email'),
          website:       str('website'),
          contactPerson: str('contactPerson'),
          paymentTerms:  Number(fd.get('paymentTerms') || 30),
          // Deliberate: the API's zod schema spells this `bbbbeeLlevel`. It is a
          // typo, but it is the shipped contract — renaming it here would 400.
          bbbbeeLlevel:  level ? Number(level) : undefined,
          womenOwned:    fd.get('womenOwned') === 'on',
          youthOwned:    fd.get('youthOwned') === 'on',
          notes:         str('notes'),
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error ?? 'Could not save that supplier')
      }
      close()
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save that supplier')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>Add supplier</Button>

      <Modal open={open} onClose={close} title="Add supplier" size="md">
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className={LABEL} htmlFor="sup-name">Supplier name *</label>
            <input id="sup-name" name="name" required maxLength={300} className={FIELD}
                   placeholder="e.g. Makro Springfield" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={LABEL} htmlFor="sup-cat">Category</label>
              <input id="sup-cat" name="category" maxLength={100} className={FIELD}
                     placeholder="e.g. Building materials" />
            </div>
            <div>
              <label className={LABEL} htmlFor="sup-contact">Contact person</label>
              <input id="sup-contact" name="contactPerson" maxLength={200} className={FIELD} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={LABEL} htmlFor="sup-phone">Phone</label>
              <input id="sup-phone" name="phone" type="tel" maxLength={20} className={FIELD}
                     placeholder="+27 …" />
            </div>
            <div>
              <label className={LABEL} htmlFor="sup-email">Email</label>
              <input id="sup-email" name="email" type="email" className={FIELD} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={LABEL} htmlFor="sup-terms">Payment terms (days)</label>
              <input id="sup-terms" name="paymentTerms" type="number" min={0} defaultValue={30}
                     className={FIELD} />
            </div>
            <div>
              <label className={LABEL} htmlFor="sup-bbbee">B-BBEE level</label>
              <select id="sup-bbbee" name="bbbbeeLlevel" defaultValue="" className={FIELD}>
                <option value="">Not recorded</option>
                {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                  <option key={n} value={n}>Level {n}</option>
                ))}
              </select>
            </div>
          </div>

          <fieldset className="rounded-lg border border-[var(--border)] p-3">
            <legend className="px-1 text-xs text-[var(--text-secondary)]">Ownership</legend>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm min-h-[44px] text-[var(--text-primary)]">
                <input type="checkbox" name="womenOwned" className="w-4 h-4" /> Women-owned
              </label>
              <label className="flex items-center gap-2 text-sm min-h-[44px] text-[var(--text-primary)]">
                <input type="checkbox" name="youthOwned" className="w-4 h-4" /> Youth-owned
              </label>
            </div>
          </fieldset>

          <div>
            <label className={LABEL} htmlFor="sup-notes">Notes</label>
            <textarea id="sup-notes" name="notes" rows={2} maxLength={2000} className={FIELD} />
          </div>

          {error && (
            <div className="rounded-lg px-3 py-2 text-sm"
                 style={{ background: 'var(--chip-red-bg)', color: 'var(--chip-red-fg)' }}>
              {error}
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={close}>Cancel</Button>
            <Button type="submit" loading={saving}>Save supplier</Button>
          </div>
        </form>
      </Modal>
    </>
  )
}
