'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Send, Loader2 } from 'lucide-react'

type Preview = { eligible: number; selected: number; optedOut: number; noConsent: number }

// Two steps: first show who will (and won't) receive it — POPIA s69 holds back
// contacts with no consent who aren't customers, and anyone who replied STOP —
// then send on confirm. Sending a broadcast can't be undone.
export function SendCampaignButton({ campaignId }: { campaignId: string }) {
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [error, setError]     = useState<string | null>(null)
  const router = useRouter()
  const url = `/api/reach/campaigns/${campaignId}/send`

  async function run(method: 'GET' | 'POST') {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(url, { method })
      const data = await res.json().catch(() => ({})) as Preview & { error?: string }
      if (!res.ok) setError(data.error ?? 'Something went wrong')
      else if (method === 'GET') setPreview(data)
      else { setPreview(null); router.refresh() }
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  const held = preview ? preview.optedOut + preview.noConsent : 0

  return (
    <div>
      {!preview ? (
        <button
          onClick={() => run('GET')}
          disabled={loading}
          className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50"
          style={{ background: 'var(--indigo-muted)', color: 'var(--indigo-light)' }}
        >
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
          Send
        </button>
      ) : (
        <div className="text-xs space-y-1.5 max-w-[16rem]">
          <p style={{ color: 'var(--text-primary)' }}>
            Send to <strong>{preview.eligible}</strong> {preview.eligible === 1 ? 'contact' : 'contacts'}?
          </p>
          {held > 0 && (
            <p style={{ color: 'var(--text-muted)' }}>
              {held} held back: {preview.noConsent > 0 && `${preview.noConsent} with no marketing consent`}
              {preview.noConsent > 0 && preview.optedOut > 0 && ', '}
              {preview.optedOut > 0 && `${preview.optedOut} opted out`}.
            </p>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => run('POST')}
              disabled={loading || preview.eligible === 0}
              className="inline-flex items-center gap-1 font-medium px-2.5 py-1 rounded-lg disabled:opacity-50"
              style={{ background: 'var(--indigo)', color: '#fff' }}
            >
              {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
              {loading ? 'Sending…' : 'Confirm send'}
            </button>
            <button onClick={() => setPreview(null)} disabled={loading} className="px-2 py-1" style={{ color: 'var(--text-muted)' }}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {error && <p className="text-xs mt-1" style={{ color: '#EF4444' }}>{error}</p>}
    </div>
  )
}
