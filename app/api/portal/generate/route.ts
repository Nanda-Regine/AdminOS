import { z } from 'zod'
import { randomBytes } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireAddon } from '@/lib/billing/gates'
import { withRoute, unwrap, RouteError } from '@/lib/api/withRoute'

export const runtime = 'nodejs'

// POST /api/portal/generate { contactId } — a 7-day link where this customer
// sees their open invoices. The link opens this customer's invoices to whoever
// holds it, so invoice staff only.
//
// Session 20 (sixth sitting): a new link used to HARD-DELETE the customer's
// earlier links (Rule #3). Earlier links are now revoked by expiring them now
// — the portal page only accepts unexpired tokens — so the history stays.
export const POST = withRoute({
  action: 'invoices.write',
  body: z.object({ contactId: z.string().uuid() }),
  audit: 'portal.link_created',
  resourceType: 'contact',
  rateLimit: 'api',
}, async ({ ctx, body }) => {
  try { await requireAddon('client_portal') } catch {
    throw new RouteError(402, 'Client Portal add-on required', 'addon_required')
  }

  const contact = unwrap(await supabaseAdmin
    .from('contacts')
    .select('id, name:full_name, email, phone')
    .eq('id', body.contactId)
    .eq('tenant_id', ctx.tenantId)
    .is('deleted_at', null)
    .maybeSingle(), { required: true, what: 'Contact not found' })

  const now = new Date().toISOString()
  unwrap(await supabaseAdmin
    .from('portal_sessions')
    .update({ expires_at: now })
    .eq('tenant_id', ctx.tenantId)
    .eq('contact_id', contact.id)
    .gt('expires_at', now))

  const token     = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  unwrap(await supabaseAdmin
    .from('portal_sessions')
    .insert({ tenant_id: ctx.tenantId, contact_id: contact.id, token, expires_at: expiresAt }))

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://adminos.co.za'
  return {
    id:         contact.id,
    url:        `${baseUrl}/portal/${token}`,
    expires_at: expiresAt,
    contact:    { id: contact.id, name: contact.name, email: contact.email, phone: contact.phone },
  }
})
