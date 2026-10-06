import { z } from 'zod'
import { withRoute, unwrap, RouteError } from '@/lib/api/withRoute'
import { sendEmail, EmailError } from '@/lib/email/send'

const DRAFT_COLUMNS =
  'id, email_type, category, subject, body, recipient_name, recipient_email, tone_used, language_used, status, sent_at, created_at'

export const GET = withRoute({ action: 'email.drafts' }, async ({ ctx, params }) =>
  unwrap(await ctx.db
    .from('email_drafts')
    .select(DRAFT_COLUMNS)
    .eq('id', params.id)
    .eq('tenant_id', ctx.tenantId)
    .is('deleted_at', null)
    .maybeSingle(), { required: true, what: 'Draft not found' }))

// Editable fields only (email_drafts has no updated_at column).
const patchSchema = z.object({
  subject: z.string().trim().min(1).max(300).optional(),
  body: z.string().max(20000).optional(),
  recipient_name: z.string().max(200).optional(),
  recipient_email: z.string().email().optional(),
})

export const PATCH = withRoute({
  action: 'email.drafts',
  body: patchSchema,
  audit: 'email_draft.updated',
  resourceType: 'email_draft',
}, async ({ ctx, params, body }) =>
  unwrap(await ctx.db
    .from('email_drafts')
    .update(body)
    .eq('id', params.id)
    .eq('tenant_id', ctx.tenantId)
    .is('deleted_at', null)
    .eq('status', 'draft')   // a sent email is a record, not a draft to rewrite
    .select(DRAFT_COLUMNS)
    .maybeSingle(), { required: true, what: 'Draft not found (or already sent)' }))

const sendSchema = z.object({ action: z.literal('send') })

// Send. It ignored Resend's result — the SDK resolves { error } rather than
// throwing — so with the key revoked every draft was marked "sent" and
// nothing was delivered. Now the draft is marked sent only once Resend
// accepted it, and the owner is told why when it was not.
export const POST = withRoute({
  action: 'email.drafts',
  body: sendSchema,
  audit: 'email_draft.sent',
  resourceType: 'email_draft',
  rateLimit: 'agents',
}, async ({ ctx, params }) => {
  const draft = unwrap(await ctx.db
    .from('email_drafts')
    .select('id, subject, body, recipient_email, status')
    .eq('id', params.id)
    .eq('tenant_id', ctx.tenantId)
    .is('deleted_at', null)
    .maybeSingle(), { required: true, what: 'Draft not found' })
  if (draft.status === 'sent') throw new RouteError(409, 'This email has already been sent.', 'already_sent')
  if (!draft.recipient_email) throw new RouteError(400, 'Add a recipient email address first.', 'no_recipient')

  try {
    await sendEmail({ to: draft.recipient_email, subject: draft.subject, text: draft.body })
  } catch (e) {
    if (e instanceof EmailError && e.reason === 'not_configured') {
      throw new RouteError(503, 'Email sending is not set up for AdminOS yet, so nothing was sent. Copy the draft into your own email for now.', 'email_not_configured')
    }
    throw new RouteError(502, 'The email service refused this message, so nothing was sent. Check the address and try again.', 'email_rejected')
  }

  return unwrap(await ctx.db
    .from('email_drafts')
    .update({ status: 'sent', sent_at: new Date().toISOString() })
    .eq('id', params.id)
    .eq('tenant_id', ctx.tenantId)
    .select('id, status, sent_at')
    .single(), { required: true })
})

// Soft delete (Rule #3) — it was a hard delete.
export const DELETE = withRoute({
  action: 'email.drafts',
  audit: 'email_draft.deleted',
  resourceType: 'email_draft',
}, async ({ ctx, params }) => {
  unwrap(await ctx.db
    .from('email_drafts')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', params.id)
    .eq('tenant_id', ctx.tenantId)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle(), { required: true, what: 'Draft not found' })
  return { id: params.id, deleted: true }
})
