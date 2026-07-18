'use client'

import { useState } from 'react'
import { Check, PencilLine, EyeOff } from 'lucide-react'

type Tier = 'A' | 'B' | 'C'
interface Decision { domain: string; decision_type: string; label: string; description: string; tier: Tier }

const OPTIONS: { tier: Tier; label: string; icon: typeof Check; hint: string }[] = [
  { tier: 'A', label: 'Auto', icon: Check, hint: 'AdminOS does it' },
  { tier: 'B', label: 'Draft', icon: PencilLine, hint: 'Prepared, you send' },
  { tier: 'C', label: 'Off', icon: EyeOff, hint: 'Only notify you' },
]

const DOMAIN_LABEL: Record<string, string> = {
  money: 'Money', ops: 'Operations', sales: 'Sales', people: 'People', governance: 'Governance',
}

export function AutonomyControls({ initial }: { initial: Decision[] }) {
  const [decisions, setDecisions] = useState(initial)
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function setTier(d: Decision, tier: Tier) {
    const key = `${d.domain}/${d.decision_type}`
    const prev = d.tier
    setError(null)
    setDecisions(list => list.map(x => x.decision_type === d.decision_type && x.domain === d.domain ? { ...x, tier } : x))
    setSaving(key)
    try {
      const res = await fetch('/api/autonomy', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ domain: d.domain, decision_type: d.decision_type, tier }) })
      if (!res.ok) {
        const b = await res.json().catch(() => ({}))
        throw new Error(b.error || 'Could not save')
      }
    } catch (e) {
      setDecisions(list => list.map(x => x.decision_type === d.decision_type && x.domain === d.domain ? { ...x, tier: prev } : x))
      setError(e instanceof Error ? e.message : 'Could not save')
    } finally {
      setSaving(null)
    }
  }

  // group by domain
  const groups = Array.from(new Set(decisions.map(d => d.domain))).map(domain => ({
    domain, items: decisions.filter(d => d.domain === domain),
  }))

  return (
    <div className="space-y-6">
      {error && (
        <p className="text-sm rounded-lg px-3 py-2" style={{ color: '#F87171', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)' }}>{error}</p>
      )}
      {groups.map(g => (
        <div key={g.domain} className="glass rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{DOMAIN_LABEL[g.domain] ?? g.domain}</h3>
          </div>
          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {g.items.map(d => {
              const key = `${d.domain}/${d.decision_type}`
              return (
                <div key={key} className="flex items-center justify-between gap-4 px-5 py-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{d.label}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{d.description}</p>
                  </div>
                  <div className="flex rounded-lg overflow-hidden shrink-0" style={{ border: '1px solid var(--border)' }}>
                    {OPTIONS.map(o => {
                      const active = d.tier === o.tier
                      return (
                        <button key={o.tier} onClick={() => setTier(d, o.tier)} disabled={saving === key} title={o.hint}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-60"
                          style={active
                            ? { background: 'var(--indigo)', color: '#fff' }
                            : { background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
                          <o.icon className="w-3.5 h-3.5" /> {o.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
      <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
        <strong>Auto</strong> = AdminOS acts on its own · <strong>Draft</strong> = it prepares it and waits for you · <strong>Off</strong> = it only notifies you. Final demands can never be automated — that&apos;s the law.
      </p>
    </div>
  )
}
