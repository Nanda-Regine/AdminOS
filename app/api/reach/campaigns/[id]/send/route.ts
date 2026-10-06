import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireAddon } from '@/lib/billing/gates'
import { inngest } from '@/inngest/client'
import { withRoute, unwrap, conflict, badRequest, RouteError } from '@/lib/api/withRoute'
import { resolveAudience, type AudienceFilter } from '@/lib/reach/audience'

export const runtime = 'nodejs'

// Rebuilt Session 20 (sixth sitting). The old route messaged EVERY contact with
// a phone number — no consent check, no opt-out, no opt-out line (POPIA s69),
// stopped at 1000 contacts, re-checked status and claimed it in two steps (a
// double-click sent twice), and sent inside the request after returning 202,
// which Vercel cuts off. Sending is now inngest/functions/reachCampaignSend.ts.

async function reachAddon() {
  try { await requireAddon('reach') } catch {
    throw new RouteError(402, 'Reach add-on required', 'addon_required')
  }
}

async function loadCampaign(tenantId: string, id: string) {
  return unwrap(await supabaseAdmin
    .from('broadcast_campaigns')
    .select('id, name, status, message_body, audience_filter')
    .eq('id', id).eq('tenant_id', tenantId).is('deleted_at', null)
    .maybeSingle(), { required: true, what: 'Campaign not found' })
}

// GET — who this would reach, before the owner commits to sending.
export const GET = withRoute({ action: 'broadcasts.send' }, async ({ ctx, params }) => {
  await reachAddon()
  const campaign = await loadCampaign(ctx.tenantId, params.id)
  const a = await resolveAudience(ctx.tenantId, (campaign.audience_filter ?? {}) as AudienceFilter)
  return { eligible: a.eligible.length, selected: a.selected, optedOut: a.optedOut, noConsent: a.noConsent }
})

// POST — claim the draft and queue the send.
export const POST = withRoute({
  action: 'broadcasts.send',
  audit: 'reach.campaign_sent',
  resourceType: 'broadcast_campaign',
  rateLimit: 'agents',
}, async ({ ctx, params }) => {
  await reachAddon()
  const campaign = await loadCampaign(ctx.tenantId, params.id)
  if (campaign.status === 'sent' || campaign.status === 'sending') throw conflict('This campaign has already been sent.')
  if (!campaign.message_body?.trim()) throw badRequest('This campaign has no message.')

  const { data: tenant } = await supabaseAdmin.from('tenants').select('meta_phone_number_id').eq('id', ctx.tenantId).maybeSingle()
  if (!tenant?.meta_phone_number_id) throw badRequest('Connect your WhatsApp Business number in Settings before sending.')

  const audience = await resolveAudience(ctx.tenantId, (campaign.audience_filter ?? {}) as AudienceFilter)
  if (!audience.eligible.length) {
    throw badRequest(audience.selected
      ? `None of the ${audience.selected} selected contacts can receive marketing: they have no recorded consent, aren't customers, or opted out.`
      : 'No contacts with a phone number match this audience.')
  }

  // Claim conditionally, so two clicks can't both send.
  const claimed = unwrap(await supabaseAdmin
    .from('broadcast_campaigns')
    .update({ status: 'sending', total_recipients: audience.eligible.length, updated_at: new Date().toISOString() })
    .eq('id', campaign.id).eq('tenant_id', ctx.tenantId)
    .in('status', ['draft', 'scheduled'])
    .select('id').maybeSingle())
  if (!claimed) throw conflict('This campaign is already being sent.')

  try {
    await inngest.send({ name: 'adminos/reach.campaign.send', data: { tenant_id: ctx.tenantId, campaign_id: campaign.id } })
  } catch (e) {
    await supabaseAdmin.from('broadcast_campaigns').update({ status: 'draft' }).eq('id', campaign.id).eq('tenant_id', ctx.tenantId)
    throw e
  }

  return {
    id: campaign.id,
    total_recipients: audience.eligible.length,
    held_back: audience.optedOut + audience.noConsent,
  }
})
