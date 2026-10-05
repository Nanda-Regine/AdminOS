'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Modal, FormField, inputCls, inputSty, Btn } from '@/components/ui/modal'
import { formatZAR } from '@/lib/format'

const METHODS = [
  { key: 'eft', label: 'EFT / bank transfer' },
  { key: 'cash', label: 'Cash' },
  { key: 'card', label: 'Card' },
  { key: 'mobile_money', label: 'Mobile money' },
  { key: 'other', label: 'Other' },
]

const PAYABLE = ['sent', 'unpaid', 'partial', 'overdue', 'in_collections']
const CANCELLABLE = ['draft', 'sent', 'unpaid', 'overdue']

/**
 * Record a payment, mark paid, cancel, issue or delete a draft — the "Get paid"
 * step of the loop. Until this existed the web app had no way to record that
 * an invoice was paid: the PATCH route had no caller, so every invoice stayed
 * outstanding (and in the debt-recovery queue) forever unless it was a cash sale.
 */
export function InvoiceActions({ id, status, amount, amountPaid, label }: {
  id: string
  status: string
  amount: number
  amountPaid: number
  label: string
}) {
  const router = useRouter()
  const owed = Math.max(0, Math.round((amount - amountPaid) * 100) / 100)
  const [mode, setMode] = useState<null | 'pay' | 'cancel' | 'delete'>(null)
  const [payAmount, setPayAmount] = useState(String(owed))
  const [method, setMethod] = useState('eft')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function send(method: 'PATCH' | 'DELETE', body?: unknown) {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/invoices/${id}`, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error ?? `Request failed (${res.status})`)
      }
      setMode(null)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  function open(m: 'pay' | 'cancel' | 'delete') {
    setError(null)
    setPayAmount(String(owed))
    setMode(m)
  }

  const btn = 'text-xs hover:underline whitespace-nowrap'
  const amt = Number(payAmount)

  return (
    <>
      <div className="flex items-center gap-3">
        {PAYABLE.includes(status) && owed > 0 && (
          <button type="button" className={btn} style={{ color: '#22C55E' }} onClick={() => open('pay')}>
            Record payment
          </button>
        )}
        {status === 'draft' && (
          <button type="button" className={btn} style={{ color: 'var(--indigo)' }} disabled={loading}
            onClick={() => send('PATCH', { status: 'sent' })}>
            Mark sent
          </button>
        )}
        {CANCELLABLE.includes(status) && amountPaid === 0 && (
          <button type="button" className={btn} style={{ color: 'var(--text-muted)' }}
            onClick={() => open(status === 'draft' ? 'delete' : 'cancel')}>
            {status === 'draft' ? 'Delete' : 'Cancel'}
          </button>
        )}
      </div>

      <Modal open={mode === 'pay'} onClose={() => !loading && setMode(null)} title="Record payment" size="sm">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (!(amt > 0)) { setError('Enter an amount greater than zero.'); return }
            if (amt > owed + 0.005) { setError(`Only ${formatZAR(owed)} is outstanding.`); return }
            send('PATCH', { payment: { amount: amt, method } })
          }}
        >
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {label} — {formatZAR(owed)} outstanding of {formatZAR(amount)}.
            Recording the full amount marks it paid and stops reminders.
          </p>
          <FormField label="Amount received (R)">
            <input type="number" min="0.01" step="0.01" max={owed} value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)} className={inputCls} style={inputSty} required />
          </FormField>
          <FormField label="Paid by">
            <select value={method} onChange={(e) => setMethod(e.target.value)} className={inputCls} style={inputSty}>
              {METHODS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
            </select>
          </FormField>
          {error && <p className="text-sm text-red-400 rounded-lg px-3 py-2" style={{ background: 'rgba(239,68,68,0.1)' }}>{error}</p>}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Btn variant="ghost" onClick={() => setMode(null)}>Close</Btn>
            <Btn type="submit" loading={loading}>{amt >= owed ? 'Mark paid' : 'Record part-payment'}</Btn>
          </div>
        </form>
      </Modal>

      <Modal open={mode === 'cancel' || mode === 'delete'} onClose={() => !loading && setMode(null)}
        title={mode === 'delete' ? 'Delete draft?' : 'Cancel invoice?'} size="sm">
        <div className="space-y-4">
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {mode === 'delete'
              ? `${label} has never been sent. Deleting removes it from your lists.`
              : `${label} will be marked cancelled. It stays on record (it was issued), stops counting as owed, and no more reminders go out.`}
          </p>
          {error && <p className="text-sm text-red-400 rounded-lg px-3 py-2" style={{ background: 'rgba(239,68,68,0.1)' }}>{error}</p>}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Btn variant="ghost" onClick={() => setMode(null)}>Keep it</Btn>
            <Btn loading={loading} onClick={() => (mode === 'delete' ? send('DELETE') : send('PATCH', { status: 'cancelled' }))}>
              {mode === 'delete' ? 'Delete draft' : 'Cancel invoice'}
            </Btn>
          </div>
        </div>
      </Modal>
    </>
  )
}
