'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { Modal, FormField, inputCls, inputSty, Btn } from '@/components/ui/modal'

const TYPES = [
  { value: 'receive',  label: 'Receive stock (in)' },
  { value: 'sell',     label: 'Sell (out)' },
  { value: 'return',   label: 'Customer return (in)' },
  { value: 'damage',   label: 'Damaged / written off (out)' },
  { value: 'transfer', label: 'Transfer out' },
  { value: 'adjust',   label: 'Stocktake adjustment' },
]

const EMPTY = { transactionType: 'receive', adjustDirection: 'decrease', quantity: '', unitCost: '', reference: '', notes: '' }

export function RecordTransactionModal({
  productId, unit, currentStock,
}: { productId: string; unit: string | null; currentStock: number }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  function handleOpen() { setForm(EMPTY); setError(null); setOpen(true) }
  function handleClose() { if (!loading) setOpen(false) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const qty = parseInt(form.quantity, 10)
    if (!Number.isFinite(qty) || qty <= 0) { setError('Enter a quantity greater than 0'); return }

    // 'adjust' is the one type that corrects stock either direction — the API
    // takes it as a signed quantity, so apply the sign from the toggle below.
    const signedQty = form.transactionType === 'adjust' && form.adjustDirection === 'decrease' ? -qty : qty

    setLoading(true)
    try {
      const body = {
        productId,
        transactionType: form.transactionType,
        quantity: signedQty,
        unitCost: form.unitCost ? parseFloat(form.unitCost) : undefined,
        reference: form.reference.trim() || undefined,
        notes: form.notes.trim() || undefined,
      }
      const res = await fetch('/api/inventory/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium flex-shrink-0"
        style={{ background: 'var(--indigo)', color: '#fff' }}>
        <Plus className="w-3.5 h-3.5" />
        Record Transaction
      </button>

      <Modal open={open} onClose={handleClose} title="Record Stock Transaction" size="md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField label="Type *">
            <select name="transactionType" value={form.transactionType} onChange={handleChange}
              className={inputCls} style={inputSty}>
              {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </FormField>

          {form.transactionType === 'adjust' && (
            <FormField label="Direction *">
              <div className="flex gap-2">
                {(['decrease', 'increase'] as const).map(dir => (
                  <button
                    key={dir}
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, adjustDirection: dir }))}
                    className="flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors"
                    style={
                      form.adjustDirection === dir
                        ? { background: dir === 'decrease' ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)', color: dir === 'decrease' ? '#F87171' : '#22C55E', borderColor: dir === 'decrease' ? '#F87171' : '#22C55E' }
                        : { background: 'transparent', color: 'var(--text-muted)', borderColor: 'var(--border)' }
                    }
                  >
                    {dir === 'decrease' ? '↓ Correct down' : '↑ Correct up'}
                  </button>
                ))}
              </div>
            </FormField>
          )}

          <FormField label={`Quantity *${unit ? ` (${unit})` : ''}`} hint={`Current stock: ${currentStock}${unit ? ` ${unit}` : ''}`}>
            <input name="quantity" type="number" min="1" step="1" required value={form.quantity} onChange={handleChange}
              className={inputCls} style={inputSty} />
          </FormField>

          <FormField label="Unit cost" hint="Optional — only relevant for receiving stock">
            <input name="unitCost" type="number" min="0" step="0.01" value={form.unitCost} onChange={handleChange}
              placeholder="0.00" className={inputCls} style={inputSty} />
          </FormField>

          <FormField label="Reference" hint="e.g. supplier invoice number, order number">
            <input name="reference" type="text" value={form.reference} onChange={handleChange}
              className={inputCls} style={inputSty} />
          </FormField>

          <FormField label="Notes">
            <textarea name="notes" rows={2} value={form.notes} onChange={handleChange}
              className={inputCls} style={inputSty} />
          </FormField>

          {error && (
            <p className="text-sm text-red-400 rounded-lg px-3 py-2" style={{ background: 'rgba(239,68,68,0.1)' }}>
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <Btn variant="ghost" onClick={handleClose} type="button">Cancel</Btn>
            <Btn type="submit" loading={loading}>Record</Btn>
          </div>
        </form>
      </Modal>
    </>
  )
}
