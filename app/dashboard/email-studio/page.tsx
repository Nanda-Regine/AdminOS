'use client'

import { useState, useRef } from 'react'
import { PenLine, Send, Save, RefreshCw, FileText, Trash2, ChevronDown } from 'lucide-react'

type Tone = 'formal' | 'friendly' | 'firm' | 'urgent'
type EmailType = 'invoice' | 'follow_up' | 'proposal' | 'welcome' | 'notice' | 'custom'
type Language = 'en' | 'af' | 'zu' | 'xh' | 'st'

interface Draft {
  id: string
  subject: string
  body: string
  recipient_email: string
  recipient_name: string
  category: EmailType
  tone_used: Tone
  status: 'draft' | 'sent'
  created_at: string
}

const TONES: { value: Tone; label: string; color: string }[] = [
  { value: 'formal', label: 'Formal', color: 'bg-navy/10 text-navy border-navy/20' },
  { value: 'friendly', label: 'Friendly', color: 'bg-forest/10 text-forest border-forest/20' },
  { value: 'firm', label: 'Firm', color: 'bg-gold/10 text-amber-800 border-gold/30' },
  { value: 'urgent', label: 'Urgent', color: 'bg-cherry/10 text-cherry border-cherry/20' },
]

const EMAIL_TYPES: { value: EmailType; label: string }[] = [
  { value: 'invoice', label: 'Invoice / Payment Request' },
  { value: 'follow_up', label: 'Follow-up' },
  { value: 'proposal', label: 'Business Proposal' },
  { value: 'welcome', label: 'Welcome / Onboarding' },
  { value: 'notice', label: 'Notice / Alert' },
  { value: 'custom', label: 'Custom' },
]

const LANGUAGES: { value: Language; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'af', label: 'Afrikaans' },
  { value: 'zu', label: 'Zulu' },
  { value: 'xh', label: 'Xhosa' },
  { value: 'st', label: 'Sotho' },
]

export default function EmailStudioPage() {
  const [tone, setTone] = useState<Tone>('formal')
  const [emailType, setEmailType] = useState<EmailType>('invoice')
  const [language, setLanguage] = useState<Language>('en')
  const [recipientName, setRecipientName] = useState('')
  const [recipientEmail, setRecipientEmail] = useState('')
  const [context, setContext] = useState('')
  const [generatedEmail, setGeneratedEmail] = useState('')
  const [generating, setGenerating] = useState(false)
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [loadingDrafts, setLoadingDrafts] = useState(false)
  const [view, setView] = useState<'compose' | 'drafts'>('compose')
  const [sendingId, setSendingId] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  async function generate() {
    if (!recipientName || !recipientEmail || !context) return
    setGenerating(true)
    setGeneratedEmail('')

    abortRef.current = new AbortController()

    try {
      const res = await fetch('/api/agents/pen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tone, emailType, recipientName, recipientEmail, context, language, saveDraft: true }),
        signal: abortRef.current.signal,
      })

      if (!res.body) throw new Error('No stream')
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') break
            try {
              const { text } = JSON.parse(data)
              setGeneratedEmail((prev) => prev + text)
            } catch { /* skip */ }
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setGeneratedEmail('Failed to generate email. Please try again.')
      }
    } finally {
      setGenerating(false)
    }
  }

  async function loadDrafts() {
    setLoadingDrafts(true)
    try {
      const res = await fetch('/api/email-drafts')
      const json = await res.json()
      setDrafts(json.data ?? [])
    } finally {
      setLoadingDrafts(false)
    }
  }

  async function sendDraft(id: string) {
    setSendingId(id)
    try {
      await fetch(`/api/email-drafts/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send' }),
      })
      setDrafts((prev) => prev.map((d) => d.id === id ? { ...d, status: 'sent' } : d))
    } finally {
      setSendingId(null)
    }
  }

  async function deleteDraft(id: string) {
    await fetch(`/api/email-drafts/${id}`, { method: 'DELETE' })
    setDrafts((prev) => prev.filter((d) => d.id !== id))
  }

  return (
    <div className="min-h-screen bg-cream">
      {/* Header */}
      <div className="bg-navy border-b border-navy/20 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gold/20 flex items-center justify-center">
              <PenLine className="w-5 h-5 text-gold" />
            </div>
            <div>
              <h1 className="font-bebas text-xl text-cream tracking-wide">Pen — Email Studio</h1>
              <p className="text-xs text-cream/50">AI-powered professional emails</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { setView('compose'); }}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${view === 'compose' ? 'bg-gold text-navy' : 'text-cream/60 hover:text-cream'}`}
            >
              Compose
            </button>
            <button
              onClick={() => { setView('drafts'); loadDrafts(); }}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${view === 'drafts' ? 'bg-gold text-navy' : 'text-cream/60 hover:text-cream'}`}
            >
              Drafts
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {view === 'compose' ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Form */}
            <div className="space-y-5">
              <div className="bg-white rounded-xl border border-forest/10 p-5 shadow-sm">
                <h2 className="font-cormorant text-lg text-navy font-semibold mb-4">Email Details</h2>

                {/* Tone selector */}
                <div className="mb-4">
                  <label className="text-xs font-medium text-navy/60 uppercase tracking-wide mb-2 block">Tone</label>
                  <div className="flex gap-2 flex-wrap">
                    {TONES.map((t) => (
                      <button
                        key={t.value}
                        onClick={() => setTone(t.value)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                          tone === t.value ? t.color + ' ring-1 ring-current' : 'bg-cream border-forest/10 text-navy/50 hover:border-forest/30'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Email type */}
                <div className="mb-4">
                  <label className="text-xs font-medium text-navy/60 uppercase tracking-wide mb-2 block">Email Type</label>
                  <div className="relative">
                    <select
                      value={emailType}
                      onChange={(e) => setEmailType(e.target.value as EmailType)}
                      className="w-full appearance-none bg-cream border border-forest/20 rounded-lg px-3 py-2 text-sm text-navy pr-8 focus:outline-none focus:ring-1 focus:ring-forest"
                    >
                      {EMAIL_TYPES.map((et) => (
                        <option key={et.value} value={et.value}>{et.label}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2 top-2.5 w-4 h-4 text-navy/40 pointer-events-none" />
                  </div>
                </div>

                {/* Language */}
                <div className="mb-4">
                  <label className="text-xs font-medium text-navy/60 uppercase tracking-wide mb-2 block">Language</label>
                  <div className="flex gap-2 flex-wrap">
                    {LANGUAGES.map((l) => (
                      <button
                        key={l.value}
                        onClick={() => setLanguage(l.value)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                          language === l.value
                            ? 'bg-forest text-cream border-forest'
                            : 'bg-cream border-forest/10 text-navy/50 hover:border-forest/30'
                        }`}
                      >
                        {l.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Recipient */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div>
                    <label className="text-xs font-medium text-navy/60 uppercase tracking-wide mb-1 block">Recipient Name</label>
                    <input
                      type="text"
                      value={recipientName}
                      onChange={(e) => setRecipientName(e.target.value)}
                      placeholder="e.g. Sipho Dlamini"
                      className="w-full bg-cream border border-forest/20 rounded-lg px-3 py-2 text-sm text-navy placeholder-navy/30 focus:outline-none focus:ring-1 focus:ring-forest"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-navy/60 uppercase tracking-wide mb-1 block">Recipient Email</label>
                    <input
                      type="email"
                      value={recipientEmail}
                      onChange={(e) => setRecipientEmail(e.target.value)}
                      placeholder="sipho@example.co.za"
                      className="w-full bg-cream border border-forest/20 rounded-lg px-3 py-2 text-sm text-navy placeholder-navy/30 focus:outline-none focus:ring-1 focus:ring-forest"
                    />
                  </div>
                </div>

                {/* Context */}
                <div className="mb-4">
                  <label className="text-xs font-medium text-navy/60 uppercase tracking-wide mb-1 block">Context & Instructions</label>
                  <textarea
                    value={context}
                    onChange={(e) => setContext(e.target.value)}
                    placeholder="e.g. Invoice #INV-2024-089 for R12,500 is 14 days overdue. Client previously paid on time. Be firm but preserve the relationship."
                    rows={5}
                    className="w-full bg-cream border border-forest/20 rounded-lg px-3 py-2 text-sm text-navy placeholder-navy/30 focus:outline-none focus:ring-1 focus:ring-forest resize-none"
                  />
                </div>

                <button
                  onClick={generate}
                  disabled={generating || !recipientName || !recipientEmail || !context}
                  className="w-full flex items-center justify-center gap-2 bg-forest text-cream py-2.5 rounded-lg font-medium text-sm hover:bg-forest/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {generating ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Writing...
                    </>
                  ) : (
                    <>
                      <PenLine className="w-4 h-4" />
                      Generate with Pen
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Right: Generated email */}
            <div className="bg-white rounded-xl border border-forest/10 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-cormorant text-lg text-navy font-semibold">Generated Email</h2>
                {generatedEmail && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => navigator.clipboard.writeText(generatedEmail)}
                      className="text-xs text-forest hover:text-forest/80 flex items-center gap-1"
                    >
                      <Save className="w-3.5 h-3.5" />
                      Copy
                    </button>
                  </div>
                )}
              </div>

              {generatedEmail ? (
                <div className="relative">
                  <textarea
                    value={generatedEmail}
                    onChange={(e) => setGeneratedEmail(e.target.value)}
                    className="w-full h-96 bg-cream border border-forest/10 rounded-lg px-4 py-3 text-sm text-navy font-mono resize-none focus:outline-none focus:ring-1 focus:ring-forest"
                  />
                  <p className="text-xs text-navy/40 mt-2">Auto-saved as draft. Edit freely above.</p>
                </div>
              ) : (
                <div className="h-96 flex flex-col items-center justify-center text-center">
                  <FileText className="w-12 h-12 text-navy/10 mb-3" />
                  <p className="text-sm text-navy/40">Your email will appear here</p>
                  <p className="text-xs text-navy/25 mt-1">Fill in the form and click Generate</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Drafts view */
          <div className="bg-white rounded-xl border border-forest/10 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-forest/10 flex items-center justify-between">
              <h2 className="font-cormorant text-lg text-navy font-semibold">Saved Drafts</h2>
              <button onClick={loadDrafts} className="text-xs text-forest flex items-center gap-1 hover:text-forest/70">
                <RefreshCw className="w-3.5 h-3.5" />
                Refresh
              </button>
            </div>

            {loadingDrafts ? (
              <div className="p-10 text-center text-navy/40 text-sm">Loading drafts...</div>
            ) : drafts.length === 0 ? (
              <div className="p-10 text-center">
                <FileText className="w-10 h-10 text-navy/10 mx-auto mb-3" />
                <p className="text-sm text-navy/40">No drafts yet — generate your first email</p>
              </div>
            ) : (
              <div className="divide-y divide-forest/5">
                {drafts.map((draft) => (
                  <div key={draft.id} className="px-5 py-4 hover:bg-cream/50 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            draft.status === 'sent'
                              ? 'bg-forest/10 text-forest'
                              : 'bg-gold/10 text-amber-800'
                          }`}>
                            {draft.status === 'sent' ? 'Sent' : 'Draft'}
                          </span>
                          <span className="text-xs text-navy/40 capitalize">{draft.tone_used}</span>
                          <span className="text-xs text-navy/40">·</span>
                          <span className="text-xs text-navy/40">{new Date(draft.created_at).toLocaleDateString('en-ZA')}</span>
                        </div>
                        <p className="text-sm font-medium text-navy truncate">{draft.subject}</p>
                        <p className="text-xs text-navy/50 truncate">To: {draft.recipient_name} ({draft.recipient_email})</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {draft.status === 'draft' && (
                          <button
                            onClick={() => sendDraft(draft.id)}
                            disabled={sendingId === draft.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-forest text-cream text-xs font-medium rounded-lg hover:bg-forest/90 disabled:opacity-50 transition-colors"
                          >
                            <Send className="w-3.5 h-3.5" />
                            {sendingId === draft.id ? 'Sending...' : 'Send'}
                          </button>
                        )}
                        <button
                          onClick={() => deleteDraft(draft.id)}
                          className="p-1.5 text-navy/30 hover:text-cherry transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
