import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'
import { withRoute, unwrap } from '@/lib/api/withRoute'
import { ownStaffId } from '@/lib/people/ownStaff'
import { canSeeAnnouncement } from '@/lib/people/announcements'

const createSchema = z.object({
  title:       z.string().trim().min(1).max(200),
  body:        z.string().trim().min(1).max(5000),
  audience:    z.enum(['all', 'managers', 'specific']).default('all'),
  audienceIds: z.array(z.string().uuid()).max(500).optional(),
  pinned:      z.boolean().default(false),
  expiresAt:   z.string().datetime({ offset: true }).optional(),
}).refine((b) => b.audience !== 'specific' || (b.audienceIds?.length ?? 0) > 0, {
  path: ['audienceIds'], message: 'Choose at least one person for a targeted announcement',
}).refine((b) => !b.expiresAt || new Date(b.expiresAt).getTime() > Date.now(), {
  path: ['expiresAt'], message: 'Expiry must be in the future',
})

export const GET = withRoute({ action: 'announcements.read' }, async ({ ctx }) => {
  const rows = unwrap(await supabaseAdmin
    .from('announcements')
    .select('id, title, body, audience, audience_ids, pinned, published_at, expires_at, created_at, announcement_reads(user_id)')
    .eq('tenant_id', ctx.tenantId)
    .is('deleted_at', null)
    .order('pinned', { ascending: false })
    .order('published_at', { ascending: false })
    .limit(200)) ?? []

  const viewer = { ...ctx, staffId: await ownStaffId(ctx.tenantId, ctx.userId) }
  return rows
    .filter((a) => canSeeAnnouncement(a, viewer))
    .map(({ announcement_reads, audience_ids: _ids, ...a }) => ({
      ...a,
      is_read: ((announcement_reads ?? []) as { user_id: string }[]).some((r) => r.user_id === ctx.userId),
    }))
})

export const POST = withRoute({
  action: 'announcements.write',
  body: createSchema,
  status: 201,
  audit: 'announcement.published',
  resourceType: 'announcement',
  rateLimit: 'api',
}, async ({ ctx, body }) => {
  return unwrap(await supabaseAdmin
    .from('announcements')
    .insert({
      tenant_id:    ctx.tenantId,
      title:        body.title,
      body:         body.body,
      audience:     body.audience,
      audience_ids: body.audience === 'specific' ? body.audienceIds : null,
      pinned:       body.pinned,
      expires_at:   body.expiresAt ?? null,
      created_by:   ctx.userId,
    })
    .select('id, title, body, audience, pinned, published_at, expires_at, created_at')
    .single(), { required: true })
})
