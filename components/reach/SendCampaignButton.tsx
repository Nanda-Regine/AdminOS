'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Send, Loader2 } from 'lucide-react'

export function SendCampaignButton({ campaignId }: { campaignId: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const router = useRouter()

  async function handleSend() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/reach/campaigns/${campaignId}/send`, { method: 'POST' })
      const data = await res.json() as { error?: string; total_recipients?: number }
      if (!res.ok) {
        setError(data.error ?? 'Send failed')
      } else {
        router.refresh()
      }
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <button
        onClick={handleSend}
        disabled={loading}
        className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50"
        style={{ background: 'var(--indigo-muted)', color: 'var(--indigo-light)' }}
      >
        {loading
          ? <Loader2 className="w-3 h-3 animate-spin" />
          : <Send className="w-3 h-3" />
        }
        {loading ? 'Sending…' : 'Send'}
      </button>
      {error && (
        <p className="text-xs mt-1" style={{ color: '#EF4444' }}>{error}</p>
      )}
    </div>
  )
}
