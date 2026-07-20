'use client'

import { useState, useRef } from 'react'
import { PenLine, Send, Save, RefreshCw, FileText, Trash2, ChevronDown, Mail } from 'lucide-react'
import { TopBar } from '@/components/dashboard/TopBar'
import { EmptyState } from '@/components/ui/EmptyState'

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

// Token-styled tone chips — the active chip's colour is applied inline below.
const TONES: { value: Tone; label: string; active: string }[] = [
  { value: 'formal',   label: 'Formal',   active: 'bg-[var(--surface-2)] text-[var(--text-primary)] border-[var(--border-hover)]' },
  { value: 'friendly', label: 'Friendly', active: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  { value: 'firm',     label: 'Firm',     active: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  { value: 'urgent',   label: 'Urgent',   active: 'bg-red-500/15 text-red-300 border-red-500/30' },
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

const inputCls =
  'w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-dim)] focus:outline-none focus:ring-1 focus:ring-[var(--indigo)]'
const labelCls = 'text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide mb-2 block'

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
  const [pendingAction, setPendingAction] = useState<{ kind: 'send' | 'delete'; id: string; subject: string } | null>(null)
  const [actionError, setActionError] = useState('')
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
    setActionError('')
    try {
      const res = await fetch(`/api/email-drafts/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send' }),
      })
      if (!res.ok) throw new Error('send failed')
      setDrafts((prev) => prev.map((d) => d.id === id ? { ...d, status: 'sent' } : d))
    } catch {
      setActionError("Couldn't send that email. Check the recipient address and try again.")
    } finally {
      setSendingId(null)
    }
  }

  async function deleteDraft(id: string) {
    setActionError('')
    try {
      const res = await fetch(`/api/email-drafts/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('delete failed')
      setDrafts((prev) => prev.filter((d) => d.id !== id))
    } catch {
      setActionError("Couldn't delete that draft. Please try again.")
    }
  }

  async function runPendingAction() {
    if (!pendingAction) return
    const { kind, id } = pendingAction
    setPendingAction(null)
    if (kind === 'send') await sendDraft(id)
    else await deleteDraft(id)
  }

  const viewToggle = (
    <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--surface-2)' }}>
      {(['compose', 'drafts'] as const).map((v) => (
        <button
          key={v}
          onClick={() => { setView(v); if (v === 'drafts') loadDrafts() }}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${
            view === v ? 'text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
          }`}
          style={view === v ? { background: 'var(--indigo)' } : undefined}
        >
          {v}
        </button>
      ))}
    </div>
  )

  return (
    <div>
      <TopBar title="Pen — Email Studio" subtitle="AI-powered professional emails" actions={viewToggle} />

      <div className="p-6">
        {view === 'compose' ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Form */}
            <div className="space-y-5">
              <div className="glass rounded-2xl p-5">
                <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Email Details</h2>

                {/* Tone selector */}
                <div className="mb-4">
                  <label className={labelCls}>Tone</label>
                  <div className="flex gap-2 flex-wrap">
                    {TONES.map((t) => (
                      <button
                        key={t.value}
                        onClick={() => setTone(t.value)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                          tone === t.value
                            ? t.active
                            : 'bg-transparent border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border-hover)]'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Email type */}
                <div className="mb-4">
                  <label className={labelCls}>Email Type</label>
                  <div className="relative">
                    <select
                      value={emailType}
                      onChange={(e) => setEmailType(e.target.value as EmailType)}
                      className={`${inputCls} appearance-none pr-8`}
                    >
                      {EMAIL_TYPES.map((et) => (
                        <option key={et.value} value={et.value}>{et.label}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2 top-2.5 w-4 h-4 text-[var(--text-muted)] pointer-events-none" />
                  </div>
                </div>

                {/* Language */}
                <div className="mb-4">
                  <label className={labelCls}>Language</label>
                  <div className="flex gap-2 flex-wrap">
                    {LANGUAGES.map((l) => (
                      <button
                        key={l.value}
                        onClick={() => setLanguage(l.value)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                          language === l.value
                            ? 'text-white border-transparent'
                            : 'bg-transparent border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border-hover)]'
                        }`}
                        style={language === l.value ? { background: 'var(--indigo)' } : undefined}
                      >
                        {l.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Recipient */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div>
                    <label className={labelCls.replace('mb-2', 'mb-1')}>Recipient Name</label>
                    <input
                      type="text"
                      value={recipientName}
                      onChange={(e) => setRecipientName(e.target.value)}
                      placeholder="e.g. Sipho Dlamini"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls.replace('mb-2', 'mb-1')}>Recipient Email</label>
                    <input
                      type="email"
                      value={recipientEmail}
                      onChange={(e) => setRecipientEmail(e.target.value)}
                      placeholder="sipho@example.co.za"
                      className={inputCls}
                    />
                  </div>
                </div>

                {/* Context */}
                <div className="mb-4">
                  <label className={labelCls.replace('mb-2', 'mb-1')}>Context &amp; Instructions</label>
                  <textarea
                    value={context}
                    onChange={(e) => setContext(e.target.value)}
                    placeholder="e.g. Invoice #INV-2024-089 for R12,500 is 14 days overdue. Client previously paid on time. Be firm but preserve the relationship."
                    rows={5}
                    className={`${inputCls} resize-none`}
                  />
                </div>

                <button
                  onClick={generate}
                  disabled={generating || !recipientName || !recipientEmail || !context}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium text-sm text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                  style={{ background: 'var(--indigo)' }}
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
            <div className="glass rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">Generated Email</h2>
                {generatedEmail && (
                  <button
                    onClick={() => navigator.clipboard.writeText(generatedEmail)}
                    className="text-xs text-[var(--indigo-light)] hover:opacity-80 flex items-center gap-1"
                  >
                    <Save className="w-3.5 h-3.5" />
                    Copy
                  </button>
                )}
              </div>

              {generatedEmail ? (
                <div className="relative">
                  <textarea
                    value={generatedEmail}
                    onChange={(e) => setGeneratedEmail(e.target.value)}
                    className={`${inputCls} h-96 font-mono resize-none`}
                  />
                  <p className="text-xs text-[var(--text-muted)] mt-2">Auto-saved as draft. Edit freely above.</p>
                </div>
              ) : (
                <div className="h-96 flex items-center justify-center">
                  <EmptyState
                    icon={Mail}
                    title="Your email will appear here"
                    body="Fill in the form and click Generate — Pen drafts it in your chosen tone and language."
                    compact
                  />
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Drafts view */
          <div className="glass rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">Saved Drafts</h2>
              <button onClick={loadDrafts} className="text-xs text-[var(--indigo-light)] flex items-center gap-1 hover:opacity-80">
                <RefreshCw className="w-3.5 h-3.5" />
                Refresh
              </button>
            </div>

            {loadingDrafts ? (
              <div className="p-10 text-center text-[var(--text-muted)] text-sm">Loading drafts...</div>
            ) : drafts.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No drafts yet"
                body="Generate your first email in Compose — it's saved here automatically so you can review and send it."
                action={{ label: 'Compose an email', onClick: () => setView('compose') }}
                compact
              />
            ) : (
              <div className="divide-y divide-[var(--border)]">
                {drafts.map((draft) => (
                  <div key={draft.id} className="px-5 py-4 hover:bg-[var(--surface-hover)] transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            draft.status === 'sent'
                              ? 'bg-emerald-500/15 text-emerald-300'
                              : 'bg-amber-500/15 text-amber-300'
                          }`}>
                            {draft.status === 'sent' ? 'Sent' : 'Draft'}
                          </span>
                          <span className="text-xs text-[var(--text-muted)] capitalize">{draft.tone_used}</span>
                          <span className="text-xs text-[var(--text-dim)]">·</span>
                          <span className="text-xs text-[var(--text-muted)]">{new Date(draft.created_at).toLocaleDateString('en-ZA')}</span>
                        </div>
                        <p className="text-sm font-medium text-[var(--text-primary)] truncate">{draft.subject}</p>
                        <p className="text-xs text-[var(--text-muted)] truncate">To: {draft.recipient_name} ({draft.recipient_email})</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {draft.status === 'draft' && (
                          <button
                            onClick={() => setPendingAction({ kind: 'send', id: draft.id, subject: draft.subject })}
                            disabled={sendingId === draft.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-white text-xs font-medium rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
                            style={{ background: 'var(--indigo)' }}
                          >
                            <Send className="w-3.5 h-3.5" />
                            {sendingId === draft.id ? 'Sending...' : 'Send'}
                          </button>
                        )}
                        <button
                          onClick={() => setPendingAction({ kind: 'delete', id: draft.id, subject: draft.subject })}
                          className="p-1.5 text-[var(--text-dim)] hover:text-[var(--danger)] transition-colors"
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

      {/* Error toast */}
      {actionError && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg"
          style={{ background: 'var(--surface-1)', border: '1px solid var(--border-hover)', backdropFilter: 'blur(20px)' }}
          role="alert">
          <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{actionError}</span>
          <button onClick={() => setActionError('')} className="text-xs font-medium" style={{ color: 'var(--indigo-light)' }}>Dismiss</button>
        </div>
      )}

      {/* Send / delete confirmation */}
      {pendingAction && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(4,6,20,0.7)', backdropFilter: 'blur(4px)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setPendingAction(null) }}>
          <div className="w-full max-w-sm rounded-2xl p-6"
            style={{ background: 'var(--surface-1)', border: '1px solid var(--border-hover)', backdropFilter: 'blur(24px)' }}>
            <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
              {pendingAction.kind === 'send' ? 'Send this email?' : 'Delete this draft?'}
            </h3>
            <p className="text-sm mt-1 mb-5" style={{ color: 'var(--text-muted)' }}>
              {pendingAction.kind === 'send'
                ? `"${pendingAction.subject}" will be emailed to the recipient now. This can't be undone.`
                : `"${pendingAction.subject}" will be permanently removed.`}
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setPendingAction(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium"
                style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                Cancel
              </button>
              <button onClick={runPendingAction}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white hover:opacity-90"
                style={{ background: pendingAction.kind === 'delete' ? 'var(--danger)' : 'var(--indigo)' }}>
                {pendingAction.kind === 'send' ? 'Send email' : 'Delete draft'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
