'use client'

import { useEffect, useState } from 'react'

type ReviewInvoice = {
  id: string
  contact_name: string | null
  contact_phone: string | null
  contact_email: string | null
  amount: number
  amount_paid: number | null
  due_date: string | null
  days_overdue: number | null
  recovery_tier: number | null
  reference: string | null
}

// Surfaces debt-recovery escalations the engine flagged for the owner (tier 4+).
// AdminOS never auto-sends these — the owner reviews and acts. Hidden entirely
// when the queue is empty so it never nags.
export function RecoveryReviewQueue() {
  const [items, setItems] = useState<ReviewInvoice[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/invoices/recovery')
      .then(r => r.ok ? r.json() : { invoices: [] })
      .then(d => setItems(d.invoices ?? []))
      .catch(() => setItems([]))
  }, [])

  async function act(invoiceId: string, action: 'pause' | 'resume' | 'mark_handled') {
    setBusy(invoiceId)
    try {
      const res = await fetch('/api/invoices/recovery', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId, action }),
      })
      if (res.ok) setItems(cur => (cur ?? []).filter(i => i.id !== invoiceId))
    } finally {
      setBusy(null)
    }
  }

  if (!items || items.length === 0) return null

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-amber-600">⚠️</span>
        <h3 className="font-semibold text-amber-900">Needs your review — {items.length} overdue {items.length === 1 ? 'account' : 'accounts'}</h3>
      </div>
      <p className="text-sm text-amber-800/80 mb-4">
        AdminOS sends gentle reminders automatically, but stops before anything firmer. These accounts are significantly
        overdue — decide how to handle each. Contact the customer yourself, pause recovery if it&rsquo;s disputed or being
        arranged, or resume gentle reminders.
      </p>
      <div className="space-y-3">
        {items.map(inv => {
          const owed = Number(inv.amount) - Number(inv.amount_paid ?? 0)
          return (
            <div key={inv.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-white border border-amber-100 p-4">
              <div className="min-w-[180px]">
                <p className="font-medium text-gray-900">{inv.contact_name || '(Unknown)'}</p>
                <p className="text-xs text-gray-400">{inv.contact_phone || inv.contact_email || '—'}</p>
              </div>
              <div className="min-w-[120px]">
                <p className="font-semibold text-gray-900">R{owed.toLocaleString('en-ZA')}</p>
                <p className="text-xs text-red-600">{inv.days_overdue ?? 0} days overdue</p>
              </div>
              <div className="text-xs text-gray-500 min-w-[90px]">
                Ref {inv.reference || inv.id.slice(0, 8)}
              </div>
              <div className="flex gap-2 ml-auto">
                <button disabled={busy === inv.id} onClick={() => act(inv.id, 'mark_handled')}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50">
                  I&rsquo;ve contacted them
                </button>
                <button disabled={busy === inv.id} onClick={() => act(inv.id, 'pause')}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                  Pause
                </button>
                <button disabled={busy === inv.id} onClick={() => act(inv.id, 'resume')}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                  Resume reminders
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
