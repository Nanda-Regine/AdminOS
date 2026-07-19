'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Modal, FormField, inputCls, inputSty, Btn } from '@/components/ui/modal'
import { Plus } from 'lucide-react'

const EMPTY = {
  name: '', sku: '', category: '', unit: 'unit',
  currentStock: '', reorderLevel: '', costPrice: '', unitPrice: '',
}
type FormState = typeof EMPTY

export function CreateProductModal() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }
  function handleOpen() { setForm(EMPTY); setError(null); setOpen(true) }
  function handleClose() { if (!loading) setOpen(false) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const num = (v: string) => (v.trim() === '' ? undefined : Number(v))
      const body = {
        name: form.name.trim(),
        sku: form.sku.trim() || undefined,
        category: form.category.trim() || undefined,
        unit: form.unit.trim() || 'unit',
        currentStock: num(form.currentStock) ?? 0,
        reorderLevel: num(form.reorderLevel) ?? 0,
        costPrice: num(form.costPrice),
        unitPrice: num(form.unitPrice),
      }
      const res = await fetch('/api/inventory', {
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
        New product
      </button>

      <Modal open={open} onClose={handleClose} title="New product" size="md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField label="Product name *">
            <input name="name" type="text" required value={form.name} onChange={handleChange}
              placeholder="e.g. Cement 50kg bag" className={inputCls} style={inputSty} />
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="SKU">
              <input name="sku" type="text" value={form.sku} onChange={handleChange}
                placeholder="e.g. CEM-50" className={inputCls} style={inputSty} />
            </FormField>
            <FormField label="Category">
              <input name="category" type="text" value={form.category} onChange={handleChange}
                placeholder="e.g. Building" className={inputCls} style={inputSty} />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Current stock">
              <input name="currentStock" type="number" min="0" step="1" value={form.currentStock} onChange={handleChange}
                placeholder="0" className={inputCls} style={inputSty} />
            </FormField>
            <FormField label="Unit">
              <input name="unit" type="text" value={form.unit} onChange={handleChange}
                placeholder="unit" className={inputCls} style={inputSty} />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Cost price (R)" hint="what you pay">
              <input name="costPrice" type="number" min="0" step="0.01" value={form.costPrice} onChange={handleChange}
                placeholder="0.00" className={inputCls} style={inputSty} />
            </FormField>
            <FormField label="Selling price (R)" hint="what you charge">
              <input name="unitPrice" type="number" min="0" step="0.01" value={form.unitPrice} onChange={handleChange}
                placeholder="0.00" className={inputCls} style={inputSty} />
            </FormField>
          </div>

          <FormField label="Reorder level" hint="alert when stock drops to this">
            <input name="reorderLevel" type="number" min="0" step="1" value={form.reorderLevel} onChange={handleChange}
              placeholder="0" className={inputCls} style={inputSty} />
          </FormField>

          {error && (
            <p className="text-sm text-red-400 rounded-lg px-3 py-2" style={{ background: 'rgba(239,68,68,0.1)' }}>{error}</p>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <Btn variant="ghost" onClick={handleClose} type="button">Cancel</Btn>
            <Btn type="submit" loading={loading}>Add product</Btn>
          </div>
        </form>
      </Modal>
    </>
  )
}
