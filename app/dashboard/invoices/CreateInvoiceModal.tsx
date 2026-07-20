'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Modal, FormField, inputCls, inputSty, Btn } from '@/components/ui/modal'
import { useOpenOnParam } from '@/lib/hooks/useOpenOnParam'

interface Contact {
  id: string
  full_name: string
}

interface Props {
  contacts: Contact[]
}

export function CreateInvoiceModal({ contacts }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Lets an EmptyState CTA (`?new=1`) open this modal from the table below.
  useOpenOnParam('new', () => setOpen(true))

  // Form state
  const [contactId, setContactId] = useState('')
  const [description, setDescription] = useState('')
  const [unitPrice, setUnitPrice] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [includeVat, setIncludeVat] = useState(true)
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')
  const [reference, setReference] = useState('')
  const [billToName, setBillToName] = useState('')

  function resetForm() {
    setContactId('')
    setBillToName('')
    setDescription('')
    setUnitPrice('')
    setQuantity('1')
    setIncludeVat(true)
    setDueDate('')
    setNotes('')
    setReference('')
    setError(null)
  }

  function handleClose() {
    if (loading) return
    resetForm()
    setOpen(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const price = parseFloat(unitPrice)
    const qty = parseFloat(quantity)

    if (!description.trim()) { setError('Description is required.'); return }
    if (isNaN(price) || price <= 0) { setError('Enter a valid amount greater than 0.'); return }
    if (isNaN(qty) || qty <= 0) { setError('Quantity must be greater than 0.'); return }

    setLoading(true)
    try {
      const body = {
        contactId: contactId || undefined,
        contactName: contactId ? undefined : (billToName.trim() || undefined),
        lineItems: [
          {
            description: description.trim(),
            quantity: qty,
            unitPrice: price,
            vatRate: includeVat ? 0.15 : 0,
          },
        ],
        dueDate: dueDate || undefined,
        notes: notes.trim() || undefined,
        reference: reference.trim() || undefined,
        currency: 'ZAR',
      }

      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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

  // Derived preview
  const price = parseFloat(unitPrice) || 0
  const qty = parseFloat(quantity) || 0
  const subtotal = price * qty
  const vat = includeVat ? subtotal * 0.15 : 0
  const total = subtotal + vat

  return (
    <>
      <Btn onClick={() => setOpen(true)}>+ New Invoice</Btn>

      <Modal open={open} onClose={handleClose} title="New Invoice" size="md">
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Contact */}
          <FormField label="Contact" hint="Optional — link this invoice to a contact">
            <select
              value={contactId}
              onChange={(e) => setContactId(e.target.value)}
              className={inputCls}
              style={inputSty}
            >
              <option value="">— No contact —</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>{c.full_name}</option>
              ))}
            </select>
          </FormField>

          {/* Bill-to name — only when no contact is linked, so the invoice still names its recipient */}
          {!contactId && (
            <FormField label="Bill to (name)" hint="Who is this invoice for?">
              <input
                type="text"
                value={billToName}
                onChange={(e) => setBillToName(e.target.value)}
                placeholder="e.g. Sipho Dlamini"
                className={inputCls}
                style={inputSty}
              />
            </FormField>
          )}

          {/* Reference */}
          <FormField label="Reference / PO number" hint="Optional — your own reference">
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="e.g. PO-2026-001"
              className={inputCls}
              style={inputSty}
            />
          </FormField>

          {/* Description */}
          <FormField label="Description *">
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Web design services"
              required
              className={inputCls}
              style={inputSty}
            />
          </FormField>

          {/* Amount + Quantity */}
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Unit price (ZAR) *">
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                placeholder="0.00"
                required
                className={inputCls}
                style={inputSty}
              />
            </FormField>
            <FormField label="Quantity">
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="1"
                className={inputCls}
                style={inputSty}
              />
            </FormField>
          </div>

          {/* VAT toggle */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeVat}
              onChange={(e) => setIncludeVat(e.target.checked)}
              className="w-4 h-4 rounded accent-indigo-600"
            />
            <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
              Include 15% VAT
            </span>
          </label>

          {/* Totals preview */}
          {price > 0 && (
            <div
              className="rounded-xl px-4 py-3 text-sm space-y-1"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
            >
              <div className="flex justify-between" style={{ color: 'var(--text-muted)' }}>
                <span>Subtotal</span>
                <span>R{subtotal.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</span>
              </div>
              {includeVat && (
                <div className="flex justify-between" style={{ color: 'var(--text-muted)' }}>
                  <span>VAT (15%)</span>
                  <span>R{vat.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</span>
                </div>
              )}
              <div
                className="flex justify-between font-semibold pt-1 border-t"
                style={{ color: 'var(--text-primary)', borderColor: 'var(--border)' }}
              >
                <span>Total</span>
                <span>R{total.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          )}

          {/* Due date */}
          <FormField label="Due date" hint="Optional">
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className={inputCls}
              style={inputSty}
            />
          </FormField>

          {/* Notes */}
          <FormField label="Notes" hint="Optional — visible on the invoice">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Payment terms, additional info…"
              className={inputCls}
              style={inputSty}
            />
          </FormField>

          {/* Error */}
          {error && (
            <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <Btn type="button" variant="ghost" onClick={handleClose}>Cancel</Btn>
            <Btn type="submit" loading={loading}>
              {loading ? 'Creating…' : 'Create Invoice'}
            </Btn>
          </div>
        </form>
      </Modal>
    </>
  )
}
