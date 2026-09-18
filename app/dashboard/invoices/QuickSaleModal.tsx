'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Modal, FormField, inputCls, inputSty, Btn } from '@/components/ui/modal'
import { useOpenOnParam } from '@/lib/hooks/useOpenOnParam'
import { INCOME_ACCOUNTS, PAYMENT_METHODS } from '@/lib/finance/chartOfAccounts'
import { Plus, Trash2 } from 'lucide-react'

interface Contact { id: string; full_name: string }
interface Product { id: string; name: string; unit_price: number | null; current_stock: number }

interface ProductRow { key: string; productId: string; quantity: string }

let rowSeq = 0
const newRow = (): ProductRow => ({ key: `r${++rowSeq}`, productId: '', quantity: '1' })

/**
 * Fast, business-type-flexible cash-sale entry: invoicing is AdminOS's one
 * revenue-recording mechanism (see lib/money/signal.ts), but a walk-in
 * sale shouldn't take the same steps as billing a client on terms. This
 * skips due dates/drafts and marks the sale paid immediately, in whichever
 * shape fits — pick from stock for a retail/product sale, or a single
 * amount for a service. Posts to the same POST /api/invoices with
 * channel:'cash_sale', which forces status=paid server-side.
 */
export function QuickSaleModal({ contacts, products, defaultCategory }: {
  contacts: Contact[]
  products: Product[]
  defaultCategory: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [mode, setMode] = useState<'product' | 'quick'>(products.length > 0 ? 'product' : 'quick')
  const [contactId, setContactId] = useState('')
  const [category, setCategory] = useState(defaultCategory)
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [includeVat, setIncludeVat] = useState(true)
  const [notes, setNotes] = useState('')

  const [rows, setRows] = useState<ProductRow[]>([newRow()])
  const [description, setDescription] = useState('')
  const [unitPrice, setUnitPrice] = useState('')
  const [quantity, setQuantity] = useState('1')

  useOpenOnParam('sale', () => { reset(); setOpen(true) })

  function reset() {
    setContactId(''); setCategory(defaultCategory); setPaymentMethod('cash')
    setIncludeVat(true); setNotes(''); setRows([newRow()])
    setDescription(''); setUnitPrice(''); setQuantity('1')
    setError(null)
  }
  function handleClose() { if (!loading) { reset(); setOpen(false) } }

  const productById = (id: string) => products.find(p => p.id === id)

  const productTotal = rows.reduce((sum, r) => {
    const p = productById(r.productId)
    const qty = parseFloat(r.quantity) || 0
    return sum + (p ? Number(p.unit_price ?? 0) * qty : 0)
  }, 0)
  const quickTotal = (parseFloat(unitPrice) || 0) * (parseFloat(quantity) || 0)
  const subtotal = mode === 'product' ? productTotal : quickTotal
  const vat = includeVat ? subtotal * 0.15 : 0
  const total = subtotal + vat

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    let lineItems: Record<string, unknown>[]
    if (mode === 'product') {
      const filled = rows.filter(r => r.productId)
      if (!filled.length) { setError('Pick at least one product.'); return }
      for (const r of filled) {
        const p = productById(r.productId)!
        const qty = parseFloat(r.quantity)
        if (!(qty > 0)) { setError(`Enter a quantity for ${p.name}.`); return }
        if (qty > p.current_stock) { setError(`Only ${p.current_stock} of ${p.name} in stock.`); return }
      }
      lineItems = filled.map(r => ({ productId: r.productId, quantity: parseFloat(r.quantity), vatRate: includeVat ? 0.15 : 0 }))
    } else {
      const price = parseFloat(unitPrice)
      const qty = parseFloat(quantity)
      if (!description.trim()) { setError('Describe what was sold.'); return }
      if (!(price > 0)) { setError('Enter a valid amount.'); return }
      if (!(qty > 0)) { setError('Quantity must be greater than 0.'); return }
      lineItems = [{ description: description.trim(), unitPrice: price, quantity: qty, vatRate: includeVat ? 0.15 : 0 }]
    }

    setLoading(true)
    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactId: contactId || undefined,
          lineItems,
          category,
          paymentMethod,
          notes: notes.trim() || undefined,
          currency: 'ZAR',
          channel: 'cash_sale',
        }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => null)
        throw new Error(json?.error ?? `Request failed (${res.status})`)
      }
      router.refresh()
      handleClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button type="button" onClick={() => { reset(); setOpen(true) }}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold"
        style={{ background: 'var(--chip-green-bg)', color: 'var(--chip-green-fg)' }}>
        <Plus className="w-3.5 h-3.5" />
        Quick Sale
      </button>

      <Modal open={open} onClose={handleClose} title="Record a Cash Sale" size="md">
        <form onSubmit={handleSubmit} className="space-y-4">

          {products.length > 0 && (
            <div className="flex gap-2 p-1 rounded-lg" style={{ background: 'var(--surface-2)' }}>
              {(['product', 'quick'] as const).map(m => (
                <button key={m} type="button" onClick={() => setMode(m)}
                  className="flex-1 text-sm font-medium py-1.5 rounded-md transition-colors"
                  style={m === mode
                    ? { background: 'var(--indigo)', color: '#fff' }
                    : { color: 'var(--text-muted)' }}>
                  {m === 'product' ? 'From stock' : 'Quick amount'}
                </button>
              ))}
            </div>
          )}

          {mode === 'product' ? (
            <div className="space-y-2">
              {rows.map((row, i) => {
                const p = productById(row.productId)
                return (
                  <div key={row.key} className="flex gap-2 items-start">
                    <select value={row.productId} className={inputCls} style={inputSty}
                      onChange={e => setRows(rs => rs.map(r => r.key === row.key ? { ...r, productId: e.target.value } : r))}>
                      <option value="">Select product…</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id} disabled={p.current_stock <= 0}>
                          {p.name} — R{Number(p.unit_price ?? 0).toLocaleString('en-ZA')} ({p.current_stock} in stock)
                        </option>
                      ))}
                    </select>
                    <input type="number" min="1" step="1" value={row.quantity} placeholder="Qty"
                      className={`${inputCls} w-20 shrink-0`} style={inputSty}
                      onChange={e => setRows(rs => rs.map(r => r.key === row.key ? { ...r, quantity: e.target.value } : r))} />
                    <button type="button" onClick={() => setRows(rs => rs.length > 1 ? rs.filter(r => r.key !== row.key) : rs)}
                      className="p-2 rounded-lg shrink-0" style={{ color: 'var(--text-dim)' }} aria-label="Remove item">
                      <Trash2 className="w-4 h-4" />
                    </button>
                    {p && <span className="sr-only">{i}</span>}
                  </div>
                )
              })}
              <button type="button" onClick={() => setRows(rs => [...rs, newRow()])}
                className="text-sm font-medium" style={{ color: 'var(--indigo-light)' }}>
                + Add another item
              </button>
            </div>
          ) : (
            <>
              <FormField label="Description *">
                <input type="text" value={description} onChange={e => setDescription(e.target.value)}
                  placeholder="e.g. Consultation, Haircut, Plumbing callout"
                  className={inputCls} style={inputSty} />
              </FormField>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField label="Amount (ZAR) *">
                  <input type="number" min="0.01" step="0.01" value={unitPrice} onChange={e => setUnitPrice(e.target.value)}
                    placeholder="0.00" className={inputCls} style={inputSty} />
                </FormField>
                <FormField label="Quantity">
                  <input type="number" min="0.01" step="0.01" value={quantity} onChange={e => setQuantity(e.target.value)}
                    className={inputCls} style={inputSty} />
                </FormField>
              </div>
            </>
          )}

          <FormField label="Customer" hint="Optional — leave blank for a walk-in/cash sale">
            <select value={contactId} onChange={e => setContactId(e.target.value)} className={inputCls} style={inputSty}>
              <option value="">— Walk-in / cash sale —</option>
              {contacts.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
            </select>
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="Income category">
              <select value={category} onChange={e => setCategory(e.target.value)} className={inputCls} style={inputSty}>
                {INCOME_ACCOUNTS.map(a => <option key={a.key} value={a.key}>{a.label}</option>)}
              </select>
            </FormField>
            <FormField label="Payment method">
              <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className={inputCls} style={inputSty}>
                {PAYMENT_METHODS.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
              </select>
            </FormField>
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={includeVat} onChange={e => setIncludeVat(e.target.checked)}
              className="w-4 h-4 rounded accent-indigo-600" />
            <span className="text-sm" style={{ color: 'var(--text-primary)' }}>Include 15% VAT</span>
          </label>

          {subtotal > 0 && (
            <div className="rounded-xl px-4 py-3 text-sm space-y-1" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
              <div className="flex justify-between" style={{ color: 'var(--text-muted)' }}>
                <span>Subtotal</span><span>R{subtotal.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</span>
              </div>
              {includeVat && (
                <div className="flex justify-between" style={{ color: 'var(--text-muted)' }}>
                  <span>VAT (15%)</span><span>R{vat.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold pt-1 border-t" style={{ color: 'var(--text-primary)', borderColor: 'var(--border)' }}>
                <span>Total paid</span><span>R{total.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          )}

          <FormField label="Notes" hint="Optional">
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              className={inputCls} style={inputSty} />
          </FormField>

          {error && <p className="text-sm text-red-500 on-light bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <Btn type="button" variant="ghost" onClick={handleClose}>Cancel</Btn>
            <Btn type="submit" loading={loading}>{loading ? 'Recording…' : 'Record Sale'}</Btn>
          </div>
        </form>
      </Modal>
    </>
  )
}
