import { supabaseAdmin } from '@/lib/supabase/admin'
import { withRoute, unwrap, notFound } from '@/lib/api/withRoute'
import { ownStaffId } from '@/lib/people/ownStaff'
import { canSeeAnnouncement } from '@/lib/people/announcements'

// POST /api/announcements/[id]/read — record that the caller read it.
export const POST = withRoute({ action: 'announcements.read' }, async ({ ctx, params }) => {
  const ann = unwrap(await supabaseAdmin
    .from('announcements')
    .select('id, audience, audience_ids, expires_at')
    .eq('id', params.id)
    .eq('tenant_id', ctx.tenantId)
    .is('deleted_at', null)
    .maybeSingle())
  // Same 404 for "not yours to see" as for "doesn't exist".
  if (!ann || !canSeeAnnouncement(ann, { ...ctx, staffId: await ownStaffId(ctx.tenantId, ctx.userId) })) {
    throw notFound('Announcement not found')
  }

  unwrap(await supabaseAdmin
    .from('announcement_reads')
    .upsert({ announcement_id: params.id, user_id: ctx.userId }, { onConflict: 'announcement_id,user_id', ignoreDuplicates: true }))
  return { ok: true }
})
