'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Modal, FormField, inputCls, inputSty, Btn } from '@/components/ui/modal'
import { useOpenOnParam } from '@/lib/hooks/useOpenOnParam'
import { Plus } from 'lucide-react'

interface StaffOption { id: string; full_name: string | null }

const EMPTY = { staffId: '', amount: '', category: 'travel', description: '', receiptUrl: '' }
type FormState = typeof EMPTY

export function CreateExpenseModal({ staff }: { staff: StaffOption[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }
  function handleOpen() { setForm(EMPTY); setError(null); setOpen(true) }
  function handleClose() { if (!loading) setOpen(false) }
  useOpenOnParam('new', handleOpen)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!form.staffId) { setError('Choose the staff member the claim is for.'); return }
    const amount = Number(form.amount)
    if (!(amount > 0)) { setError('Enter an amount greater than zero.'); return }
    setLoading(true)
    try {
      const body = {
        staffId: form.staffId,
        amount,
        category: form.category,
        description: form.description.trim() || undefined,
        receiptUrl: form.receiptUrl.trim() || undefined,
      }
      const res = await fetch('/api/expenses', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error ?? `Request failed (${res.status})`)
      }
      router.refresh()
      setOpen(false)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button type="button" onClick={handleOpen}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium"
        style={{ background: 'var(--indigo)', color: '#fff' }}>
        <Plus className="w-3.5 h-3.5" />
        New claim
      </button>

      <Modal open={open} onClose={handleClose} title="New expense claim" size="md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField label="Staff member *">
            <select name="staffId" required value={form.staffId} onChange={handleChange} className={inputCls} style={inputSty}>
              <option value="">Select staff…</option>
              {staff.map(s => <option key={s.id} value={s.id}>{s.full_name || 'Unnamed'}</option>)}
            </select>
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Amount (R) *">
              <input name="amount" type="number" min="0" step="0.01" required value={form.amount} onChange={handleChange}
                placeholder="0.00" className={inputCls} style={inputSty} />
            </FormField>
            <FormField label="Category">
              <select name="category" value={form.category} onChange={handleChange} className={inputCls} style={inputSty}>
                <option value="travel">Travel</option>
                <option value="meals">Meals</option>
                <option value="equipment">Equipment</option>
                <option value="accommodation">Accommodation</option>
                <option value="other">Other</option>
              </select>
            </FormField>
          </div>

          <FormField label="Description">
            <textarea name="description" rows={3} value={form.description} onChange={handleChange}
              placeholder="What was this for?" className={inputCls} style={inputSty} />
          </FormField>

          <FormField label="Receipt URL" hint="link to an uploaded receipt (optional)">
            <input name="receiptUrl" type="url" value={form.receiptUrl} onChange={handleChange}
              placeholder="https://…" className={inputCls} style={inputSty} />
          </FormField>

          {error && (
            <p className="text-sm text-red-400 rounded-lg px-3 py-2" style={{ background: 'rgba(239,68,68,0.1)' }}>{error}</p>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <Btn variant="ghost" onClick={handleClose} type="button">Cancel</Btn>
            <Btn type="submit" loading={loading}>Submit claim</Btn>
          </div>
        </form>
      </Modal>
    </>
  )
}
