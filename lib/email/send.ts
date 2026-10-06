/**
 * The one way AdminOS sends an email.
 *
 * Resend's SDK does not throw on failure — it resolves `{ data: null, error }`.
 * Every caller ignored that, so a revoked key or a missing RESEND_FROM_EMAIL
 * (both true in prod as of 2026-10-06) meant every email silently went
 * nowhere while the code carried on as if it had been delivered: drafts were
 * marked "sent", onboarding and trial-nudge steps reported success.
 *
 * sendEmail() resolves only when Resend accepted the message, and throws an
 * EmailError otherwise, so callers can show an honest error (routes) or let
 * the step fail and retry (Inngest).
 */

import { Resend } from 'resend'

export class EmailError extends Error {
  constructor(message: string, public readonly reason: 'not_configured' | 'rejected') {
    super(message)
    this.name = 'EmailError'
  }
}

let client: Resend | null = null

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL)
}

export async function sendEmail(msg: {
  to: string | string[]
  subject: string
  text?: string
  html?: string
  replyTo?: string
}): Promise<{ id: string }> {
  if (!emailConfigured()) {
    throw new EmailError('Email sending is not set up yet (RESEND_API_KEY / RESEND_FROM_EMAIL).', 'not_configured')
  }
  client ??= new Resend(process.env.RESEND_API_KEY)
  const base = {
    from: process.env.RESEND_FROM_EMAIL!,
    to: msg.to,
    subject: msg.subject,
    ...(msg.replyTo ? { replyTo: msg.replyTo } : {}),
  }
  const { data, error } = msg.html
    ? await client.emails.send({ ...base, html: msg.html, ...(msg.text ? { text: msg.text } : {}) })
    : await client.emails.send({ ...base, text: msg.text ?? '' })
  if (error || !data?.id) {
    throw new EmailError(`Email was not accepted: ${error?.message ?? 'no message id returned'}`, 'rejected')
  }
  return { id: data.id }
}

/** Escape a value for interpolation into an HTML email body. */
export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}
