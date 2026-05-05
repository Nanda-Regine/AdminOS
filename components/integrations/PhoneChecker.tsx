'use client'

import { useState } from 'react'
import { Phone, CheckCircle, XCircle, Copy } from 'lucide-react'

type PhoneResult = {
  raw:     string
  e164:    string | null
  local:   string | null
  country: string | null
  valid:   boolean
  type:    'mobile' | 'landline' | 'unknown'
  message: string
}

export function PhoneChecker() {
  const [input,   setInput]   = useState('')
  const [result,  setResult]  = useState<PhoneResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied,  setCopied]  = useState(false)

  async function check() {
    if (!input.trim()) return
    setLoading(true)
    setResult(null)
    const res  = await fetch('/api/integrations/phone', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ phone: input.trim() }),
    })
    const data = await res.json()
    setResult(data)
    setLoading(false)
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-4 max-w-md">
      <div className="flex gap-2">
        <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
          <Phone className="w-4 h-4 shrink-0" style={{ color: 'var(--text-muted)' }} />
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && check()}
            placeholder="e.g. 0821234567 or +27821234567"
            className="flex-1 text-sm bg-transparent border-none outline-none"
            style={{ color: 'var(--text-primary)' }}
          />
        </div>
        <button
          onClick={check}
          disabled={loading || !input.trim()}
          className="px-4 py-2 rounded-xl text-sm font-medium"
          style={{
            background: loading ? 'var(--indigo-muted)' : 'var(--indigo)',
            color:      loading ? 'var(--indigo-light)' : '#fff',
            cursor:     loading || !input.trim() ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Checking…' : 'Validate'}
        </button>
      </div>

      {result && (
        <div className="rounded-xl p-4 space-y-3"
          style={{ background: 'var(--surface-2)', border: `1px solid ${result.valid ? '#22C55E40' : '#EF444440'}` }}>
          <div className="flex items-center gap-2">
            {result.valid
              ? <CheckCircle className="w-4 h-4" style={{ color: '#22C55E' }} />
              : <XCircle    className="w-4 h-4" style={{ color: '#EF4444' }} />
            }
            <span className="text-sm font-medium" style={{ color: result.valid ? '#22C55E' : '#EF4444' }}>
              {result.message}
            </span>
          </div>

          {result.valid && (
            <div className="space-y-2">
              {result.e164 && (
                <div className="flex items-center justify-between">
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>E.164 (WhatsApp)</span>
                  <div className="flex items-center gap-2">
                    <code className="text-xs font-mono px-2 py-0.5 rounded"
                      style={{ background: 'var(--surface-1)', color: 'var(--text-primary)' }}>
                      {result.e164}
                    </code>
                    <button onClick={() => copy(result.e164!)} className="hover:opacity-70">
                      <Copy className="w-3.5 h-3.5" style={{ color: copied ? '#22C55E' : 'var(--text-muted)' }} />
                    </button>
                  </div>
                </div>
              )}
              {result.local && (
                <div className="flex items-center justify-between">
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Local format</span>
                  <code className="text-xs font-mono px-2 py-0.5 rounded"
                    style={{ background: 'var(--surface-1)', color: 'var(--text-primary)' }}>
                    {result.local}
                  </code>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Type</span>
                <span className="text-xs capitalize px-2 py-0.5 rounded"
                  style={{
                    background: result.type === 'mobile' ? '#22C55E20' : 'var(--surface-1)',
                    color:      result.type === 'mobile' ? '#22C55E'   : 'var(--text-muted)',
                  }}>
                  {result.type}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
