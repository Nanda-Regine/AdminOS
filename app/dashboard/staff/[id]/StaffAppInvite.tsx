'use client'

import { useState } from 'react'
import { Smartphone, Copy, Check, MessageCircle } from 'lucide-react'
import { Modal, Btn } from '@/components/ui/modal'

interface InviteResult {
  code: string
  expiresAt: string
  message: string
  whatsappUrl: string | null
  resetsExistingLogin: boolean
}

/**
 * "Send app invite" on the staff profile. Issues a one-time code (POST
 * /api/staff/[id]/invite) and hands the owner a ready WhatsApp message — the
 * only reliable channel to most employees. For staff who already have a
 * login, the same flow resets their password (no email needed).
 */
export function StaffAppInvite({ staffId, linked, hasPhone }: { staffId: string; linked: boolean; hasPhone: boolean }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [invite, setInvite] = useState<InviteResult | null>(null)
  const [copied, setCopied] = useState(false)

  async function issue() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/staff/${staffId}/invite`, { method: 'POST' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error ?? `Error ${res.status}`)
      setInvite(body as InviteResult)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the invite.')
    } finally {
      setLoading(false)
    }
  }

  async function copy() {
    if (!invite) return
    try {
      await navigator.clipboard.writeText(invite.message)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Copy failed — select the message and copy it manually.')
    }
  }

  function close() {
    if (loading) return
    setOpen(false)
    setInvite(null)
    setError(null)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full mt-4 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors"
        style={{ background: 'var(--surface-2)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
      >
        <Smartphone className="w-4 h-4" />
        {linked ? 'Reset app login' : 'Send app invite'}
      </button>
      <p className="text-xs mt-2 text-center" style={{ color: 'var(--text-muted)' }}>
        {linked ? 'Has the AdminOS staff app.' : 'Not on the staff app yet.'}
      </p>

      <Modal open={open} onClose={close} title={linked ? 'Reset app login' : 'Invite to the staff app'} size="md">
        {!invite ? (
          <div className="space-y-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
            <p>
              {linked
                ? 'This creates a one-time code that lets them choose a new password. Their current password stops working once they use it.'
                : 'This creates a one-time code. They install the AdminOS app, tap “I have an invite code”, and get their payslips, leave and clock-in on their phone.'}
            </p>
            <p>The code works once and expires in 7 days. Creating a new one cancels any earlier code.</p>
            {error && <p role="alert" className="text-red-400">{error}</p>}
            <div className="flex justify-end gap-2">
              <Btn variant="ghost" onClick={close}>Cancel</Btn>
              <Btn loading={loading} onClick={issue}>Create code</Btn>
            </div>
          </div>
        ) : (
          <div className="space-y-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
            <div className="text-center py-3 rounded-xl" style={{ background: 'var(--surface-2)' }}>
              <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Invite code</p>
              <p className="text-3xl font-mono font-bold tracking-widest" style={{ color: 'var(--text-primary)' }}>{invite.code}</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                Expires {new Date(invite.expiresAt).toLocaleDateString('en-ZA', { timeZone: 'Africa/Johannesburg', day: 'numeric', month: 'long' })}
              </p>
            </div>
            <pre className="whitespace-pre-wrap rounded-xl p-3 text-xs" style={{ background: 'var(--surface-2)', color: 'var(--text-primary)' }}>
              {invite.message}
            </pre>
            {error && <p role="alert" className="text-red-400">{error}</p>}
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" onClick={copy}
                className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm"
                style={{ background: 'var(--surface-2)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied' : 'Copy message'}
              </button>
              {invite.whatsappUrl ? (
                <a href={invite.whatsappUrl} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-white"
                  style={{ background: '#16A34A' }}>
                  <MessageCircle className="w-4 h-4" /> Send on WhatsApp
                </a>
              ) : (
                <p className="text-xs self-center" style={{ color: 'var(--text-muted)' }}>
                  {hasPhone ? 'Their phone number doesn’t look valid — copy the message instead.' : 'Add their phone number to send this on WhatsApp in one tap.'}
                </p>
              )}
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}
