'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { TopBar } from '@/components/dashboard/TopBar'
import { Radio, ArrowLeft, Send, Loader2, Users } from 'lucide-react'
import Link from 'next/link'

const CONTACT_TYPES = [
  { value: 'client',   label: 'Clients'   },
  { value: 'supplier', label: 'Suppliers' },
  { value: 'staff',    label: 'Staff'     },
  { value: 'unknown',  label: 'Other'     },
]

export default function NewCampaignPage() {
  const router = useRouter()

  const [name, setName]             = useState('')
  const [messageBody, setMessageBody] = useState('')
  const [contactTypes, setContactTypes] = useState<string[]>([])
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState<string | null>(null)

  const charCount = messageBody.length
  const overLimit = charCount > 4096

  function toggleType(value: string) {
    setContactTypes(prev =>
      prev.includes(value) ? prev.filter(t => t !== value) : [...prev, value]
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !messageBody.trim()) return
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/reach/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:            name.trim(),
          message_body:    messageBody.trim(),
          audience_filter: contactTypes.length ? { contact_type: contactTypes } : {},
          channel:         'whatsapp',
        }),
      })

      const data = await res.json() as { error?: string; id?: string }
      if (!res.ok) {
        setError(data.error ?? 'Failed to create campaign')
      } else {
        router.push('/dashboard/reach')
      }
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <TopBar title="New Campaign" subtitle="Broadcast a message to your audience" />
      <div className="p-6 max-w-2xl">

        <Link href="/dashboard/reach"
          className="inline-flex items-center gap-1.5 text-sm mb-6"
          style={{ color: 'var(--text-muted)' }}>
          <ArrowLeft className="w-4 h-4" />
          Back to Campaigns
        </Link>

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Campaign name */}
          <div className="glass rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <Radio className="w-4 h-4" style={{ color: 'var(--indigo-light)' }} />
              <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Campaign Details</h3>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                Campaign Name
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. May Promo, Payment Reminder, Product Launch"
                required
                className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none transition-colors"
                style={{
                  background:  'var(--surface-2)',
                  border:      '1px solid var(--border)',
                  color:       'var(--text-primary)',
                }}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                  Message
                </label>
                <span className="text-xs" style={{ color: overLimit ? '#EF4444' : 'var(--text-dim)' }}>
                  {charCount} / 4096
                </span>
              </div>
              <textarea
                value={messageBody}
                onChange={e => setMessageBody(e.target.value)}
                placeholder="Hi {{name}}, we have an exciting update from our team..."
                rows={6}
                required
                className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none resize-none transition-colors"
                style={{
                  background:  'var(--surface-2)',
                  border:      `1px solid ${overLimit ? '#EF4444' : 'var(--border)'}`,
                  color:       'var(--text-primary)',
                }}
              />
              <p className="text-xs mt-1.5" style={{ color: 'var(--text-dim)' }}>
                WhatsApp free-form messages work within the 24-hour customer service window.
                For outbound broadcasts, submit an approved template in Meta Business Suite.
              </p>
            </div>
          </div>

          {/* Audience */}
          <div className="glass rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-4 h-4" style={{ color: 'var(--indigo-light)' }} />
              <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Audience</h3>
            </div>

            <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
              Select contact types to include. Leave all unchecked to send to everyone.
            </p>

            <div className="flex flex-wrap gap-2">
              {CONTACT_TYPES.map(({ value, label }) => {
                const selected = contactTypes.includes(value)
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => toggleType(value)}
                    className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all"
                    style={selected ? {
                      background: 'var(--indigo)',
                      color:      '#fff',
                    } : {
                      background: 'var(--surface-2)',
                      color:      'var(--text-secondary)',
                      border:     '1px solid var(--border)',
                    }}
                  >
                    {label}
                  </button>
                )
              })}
            </div>

            {contactTypes.length === 0 && (
              <p className="text-xs mt-3 px-3 py-2 rounded-lg"
                style={{ background: 'var(--indigo-muted)', color: 'var(--indigo-light)' }}>
                Sending to all contacts with a phone number
              </p>
            )}
            {contactTypes.length > 0 && (
              <p className="text-xs mt-3 px-3 py-2 rounded-lg"
                style={{ background: 'var(--indigo-muted)', color: 'var(--indigo-light)' }}>
                Sending to: {contactTypes.join(', ')}
              </p>
            )}
          </div>

          {error && (
            <div className="px-4 py-3 rounded-xl text-sm"
              style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.3)' }}>
              {error}
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={loading || !name.trim() || !messageBody.trim() || overLimit}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
              style={{ background: 'var(--indigo)', color: '#fff' }}
            >
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                : <><Send className="w-4 h-4" /> Save Campaign</>
              }
            </button>
            <Link href="/dashboard/reach"
              className="text-sm px-4 py-2.5 rounded-xl"
              style={{ color: 'var(--text-muted)' }}>
              Cancel
            </Link>
          </div>

        </form>
      </div>
    </div>
  )
}
