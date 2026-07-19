'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2 } from 'lucide-react'

/**
 * Bot Training — POSTs policies/FAQs/tone to /api/settings/profile, which saves
 * them to tenants.settings AND rebuilds the cached system prompt (the actual
 * "retrain"). Previously the button had no handler.
 */
export function BotTrainingForm({ initial }: { initial: { policies: string; faqs: string; tone: string } }) {
  const router = useRouter()
  const [policies, setPolicies] = useState(initial.policies)
  const [faqs, setFaqs] = useState(initial.faqs)
  const [tone, setTone] = useState(initial.tone || 'warm')
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  const ta = 'w-full text-sm rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none'
  const taStyle = { background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }

  async function save() {
    setState('saving'); setError(null)
    try {
      const res = await fetch('/api/settings/profile', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ policies, faqs, tone }),
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
        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Business Policies</label>
        <textarea className={ta} style={taStyle} rows={3} value={policies} onChange={e => setPolicies(e.target.value)}
          placeholder="Your policies, procedures, and rules — the bot follows these." />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>FAQs</label>
        <textarea className={ta} style={taStyle} rows={4} value={faqs} onChange={e => setFaqs(e.target.value)}
          placeholder={'Q: What are your hours?\nA: Mon–Fri 8am–5pm'} />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Tone</label>
        <select className="w-full text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          style={taStyle} value={tone} onChange={e => setTone(e.target.value)}>
          <option value="formal">Formal &amp; Professional</option>
          <option value="warm">Warm &amp; Friendly</option>
          <option value="casual">Casual</option>
        </select>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button type="button" onClick={save} disabled={state === 'saving'}
          className="inline-flex items-center gap-2 text-white text-sm px-4 py-2 rounded-lg transition-colors disabled:opacity-60"
          style={{ background: 'var(--indigo)' }}>
          {state === 'saving' ? <Loader2 className="w-4 h-4 animate-spin" /> : state === 'saved' ? <Check className="w-4 h-4" /> : null}
          {state === 'saving' ? 'Retraining…' : state === 'saved' ? 'Saved & retrained' : 'Save & Retrain Bot'}
        </button>
        {error && <span className="text-xs" style={{ color: '#F87171' }}>{error}</span>}
      </div>
    </div>
  )
}
