'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2 } from 'lucide-react'

export interface BusinessDocumentsInitial {
  address: string
  vatNumber: string
  bankName: string
  bankAccountHolder: string
  bankAccountNumber: string
  bankBranchCode: string
}

/**
 * Business address, VAT number and banking details — shown on generated
 * invoices/receipts/payslips (via tenants.settings). "TAX INVOICE" wording
 * and the VAT breakdown only appear on invoices once a VAT number is set
 * here; banking details only appear once at least one is filled in.
 */
export function BusinessDocumentsForm({ initial }: { initial: BusinessDocumentsInitial }) {
  const router = useRouter()
  const [address, setAddress] = useState(initial.address)
  const [vatNumber, setVatNumber] = useState(initial.vatNumber)
  const [bankName, setBankName] = useState(initial.bankName)
  const [bankAccountHolder, setBankAccountHolder] = useState(initial.bankAccountHolder)
  const [bankAccountNumber, setBankAccountNumber] = useState(initial.bankAccountNumber)
  const [bankBranchCode, setBankBranchCode] = useState(initial.bankBranchCode)
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  const input = 'w-full text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500'
  const inputStyle = { background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }

  async function save() {
    setState('saving'); setError(null)
    try {
      const res = await fetch('/api/settings/profile', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address, vatNumber, bankName, bankAccountHolder, bankAccountNumber, bankBranchCode,
        }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || `Failed (${res.status})`)
      setState('saved')
      router.refresh()
      setTimeout(() => setState('idle'), 2500)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save')
      setState('error')
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Business Address</label>
        <input className={input} style={inputStyle} value={address} onChange={e => setAddress(e.target.value)}
          placeholder="12 Main Road, East London, 5201" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>VAT Number</label>
        <input className={input} style={inputStyle} value={vatNumber} onChange={e => setVatNumber(e.target.value)}
          placeholder="Leave blank if not VAT-registered" />
        <p className="text-xs mt-1" style={{ color: 'var(--text-dim)' }}>
          Only set this if you&apos;re actually VAT-registered — it controls whether invoices say &quot;TAX INVOICE&quot; and show a VAT breakdown.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Bank Name</label>
          <input className={input} style={inputStyle} value={bankName} onChange={e => setBankName(e.target.value)} placeholder="FNB" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Account Holder</label>
          <input className={input} style={inputStyle} value={bankAccountHolder} onChange={e => setBankAccountHolder(e.target.value)} placeholder="Business name" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Account Number</label>
          <input className={input} style={inputStyle} value={bankAccountNumber} onChange={e => setBankAccountNumber(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Branch Code</label>
          <input className={input} style={inputStyle} value={bankBranchCode} onChange={e => setBankBranchCode(e.target.value)} />
        </div>
      </div>
      <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
        Banking details are optional and only shown on an invoice if at least one is filled in — for customers paying by EFT.
      </p>
      <div className="mt-4 flex items-center gap-3">
        <button type="button" onClick={save} disabled={state === 'saving'}
          className="inline-flex items-center gap-2 text-white text-sm px-4 py-2 rounded-lg transition-colors disabled:opacity-60"
          style={{ background: 'var(--indigo)' }}>
          {state === 'saving' ? <Loader2 className="w-4 h-4 animate-spin" /> : state === 'saved' ? <Check className="w-4 h-4" /> : null}
          {state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved' : 'Save'}
        </button>
        {error && <span className="text-xs" style={{ color: '#F87171' }}>{error}</span>}
      </div>
    </div>
  )
}
