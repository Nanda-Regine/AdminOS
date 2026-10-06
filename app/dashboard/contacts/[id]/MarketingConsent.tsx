'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Shield, Loader2 } from 'lucide-react'

const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-ZA', { timeZone: 'Africa/Johannesburg', day: 'numeric', month: 'short', year: 'numeric' })

/**
 * POPIA s69 marketing status for one contact: who may receive Reach
 * broadcasts and sequences. Consent is recorded by the business (the person
 * agreed, e.g. on a sign-up form or in person); an opt-out is set when they
 * reply STOP or ask in person. Customers may be marketed without consent until
 * they opt out.
 */
export function MarketingConsent(props: {
  contactId: string
  isClient: boolean
  consent: boolean
  consentAt: string | null
  optedOutAt: string | null
}) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function save(field: 'popia_consent' | 'marketing_opt_out', value: boolean) {
    setBusy(field)
    setError(null)
    try {
      const res = await fetch(`/api/contacts/${props.contactId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      })
      if (!res.ok) setError(((await res.json().catch(() => ({}))) as { error?: string }).error ?? 'Could not save')
      else router.refresh()
    } catch {
      setError('Network error')
    } finally {
      setBusy(null)
    }
  }

  const { consent, consentAt, optedOutAt, isClient } = props
  const canMarket = !optedOutAt && (consent || isClient)
  const status = optedOutAt
    ? `Opted out of marketing · ${fmt(optedOutAt)}`
    : consent
      ? `Marketing consent given${consentAt ? ` · ${fmt(consentAt)}` : ''}`
      : isClient
        ? 'Customer: may receive marketing until they opt out'
        : 'No marketing consent: Reach and sequences will skip them'

  const btn = 'text-xs px-2.5 py-1 rounded-lg disabled:opacity-50 inline-flex items-center gap-1'

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Shield className="w-4 h-4 shrink-0" style={{ color: canMarket ? '#22C55E' : '#94A3B8' }} />
        <span className="text-xs" style={{ color: canMarket ? '#22C55E' : 'var(--text-dim)' }}>{status}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {optedOutAt ? (
          <button className={btn} disabled={!!busy} onClick={() => save('marketing_opt_out', false)}
            style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}
            title="Only if they have asked to receive messages again">
            {busy === 'marketing_opt_out' && <Loader2 className="w-3 h-3 animate-spin" />}They opted back in
          </button>
        ) : (
          <>
            <button className={btn} disabled={!!busy} onClick={() => save('popia_consent', !consent)}
              style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
              {busy === 'popia_consent' && <Loader2 className="w-3 h-3 animate-spin" />}
              {consent ? 'Withdraw consent' : 'Record consent'}
            </button>
            <button className={btn} disabled={!!busy} onClick={() => save('marketing_opt_out', true)}
              style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
              {busy === 'marketing_opt_out' && <Loader2 className="w-3 h-3 animate-spin" />}Opted out
            </button>
          </>
        )}
      </div>
      {error && <p className="text-xs" style={{ color: '#EF4444' }}>{error}</p>}
    </div>
  )
}
