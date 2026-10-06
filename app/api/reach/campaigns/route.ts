import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireAddon } from '@/lib/billing/gates'
import { withRoute, unwrap, RouteError } from '@/lib/api/withRoute'

export const runtime = 'nodejs'

const CONTACT_TYPES = ['client', 'supplier', 'staff', 'unknown'] as const

const createSchema = z.object({
  name:            z.string().trim().min(1, 'Give the campaign a name').max(200),
  // WhatsApp's text limit is 4096; leave room for the POPIA opt-out footer.
  message_body:    z.string().trim().min(1, 'Write the message').max(3900),
  audience_filter: z.object({ contact_type: z.array(z.enum(CONTACT_TYPES)).max(4).optional() }).strict().default({}),
  scheduled_at:    z.string().datetime({ offset: true }).nullable().optional(),
  channel:         z.literal('whatsapp').default('whatsapp'),
})

export const GET = withRoute({ action: 'broadcasts.read' }, async ({ ctx }) => {
  return unwrap(await supabaseAdmin
    .from('broadcast_campaigns')
    .select('id, name, status, channel, message_body, audience_filter, scheduled_at, sent_at, total_recipients, sent_count, delivered_count, read_count, failed_count, created_at')
    .eq('tenant_id', ctx.tenantId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(200)) ?? []
})

export const POST = withRoute({
  action: 'broadcasts.send',
  body: createSchema,
  audit: 'reach.campaign_created',
  resourceType: 'broadcast_campaign',
}, async ({ ctx, body }) => {
  try { await requireAddon('reach') } catch { throw new RouteError(402, 'Reach add-on required', 'addon_required') }
  const row = unwrap(await supabaseAdmin
    .from('broadcast_campaigns')
    .insert({
      tenant_id:       ctx.tenantId,
      name:            body.name,
      message_body:    body.message_body,
      audience_filter: body.audience_filter,
      channel:         body.channel,
      scheduled_at:    body.scheduled_at ?? null,
      status:          'draft',
      created_by:      ctx.userId,
    })
    .select('id, name, status')
    .single())
  return Response.json(row, { status: 201 })
})
