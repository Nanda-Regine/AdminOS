import { supabaseAdmin } from '@/lib/supabase/admin'
import { getContext } from '@/lib/auth/context'
import { can } from '@/lib/auth/roleMatrix'
import { ownStaffId } from '@/lib/people/ownStaff'
import { canSeeAnnouncement } from '@/lib/people/announcements'
import { TopBar } from '@/components/dashboard/TopBar'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { redirect } from 'next/navigation'
import { Megaphone, Eye, Pin } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { CreateAnnouncementForm } from './CreateAnnouncementForm'

export const dynamic = 'force-dynamic'

type AnnouncementRow = {
  id: string
  title: string
  body: string
  audience: string | null
  audience_ids: string[] | null
  expires_at: string | null
  pinned: boolean
  published_at: string | null
  created_at: string
  announcement_reads: { user_id: string }[] | null
}

export default async function AnnouncementsPage() {
  const ctx = await getContext()
  if (!ctx) redirect('/login')
  const tenantId = ctx.tenantId
  const canPublish = can(ctx, 'announcements.write')

  // Real schema: pinned / audience / published_at (no priority/channels/
  // target_roles/read_count). read count comes from the announcement_reads FK.
  const { data: announcements } = await supabaseAdmin
    .from('announcements')
    .select('id, title, body, audience, audience_ids, expires_at, pinned, published_at, created_at, announcement_reads(user_id)')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(50)

  // "Managers only" / targeted / expired posts were shown to everyone.
  const viewer = { ...ctx, staffId: await ownStaffId(tenantId, ctx.userId) }
  const items = ((announcements || []) as AnnouncementRow[]).filter((a) => canSeeAnnouncement(a, viewer))
  const pinnedCount = items.filter((a) => a.pinned).length

  const audienceLabel = (a: string | null) =>
    a === 'managers' ? 'Managers' : a === 'specific' ? 'Specific staff' : 'All staff'

  return (
    <div>
      <TopBar
        title="Announcements"
        subtitle={`${items.length} total · ${pinnedCount} pinned`}
      />
      <div className="p-4 md:p-6 space-y-6">

        {/* Create form — only for those who can publish (the API 403'd everyone else) */}
        {canPublish && (
          <Card>
            <h3 className="font-semibold text-[var(--text-primary)] mb-4">Create Announcement</h3>
            <CreateAnnouncementForm />
          </Card>
        )}

        {/* Announcements list */}
        <Card>
          <h3 className="font-semibold text-[var(--text-primary)] mb-4">{canPublish ? 'All Announcements' : 'Announcements'}</h3>

          {items.length === 0 ? (
            <EmptyState
              icon={Megaphone}
              title="No announcements yet"
              body={canPublish ? 'Create one above to notify your team.' : 'Nothing has been announced to you yet.'}
            />
          ) : (
            <div className="space-y-3">
              {items.map((item) => {
                const when = item.published_at || item.created_at
                const createdDate = when
                  ? new Date(when).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
                  : '—'
                const readCount = item.announcement_reads?.length ?? 0

                return (
                  <div
                    key={item.id}
                    className="p-4 rounded-xl border bg-[var(--surface-2)] border-[var(--border)]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <p className="text-sm font-semibold text-[var(--text-primary)]">{item.title}</p>
                          {item.pinned && (
                            <Badge variant="blue">
                              <Pin className="w-3 h-3 mr-1 inline" />Pinned
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-[var(--text-muted)] mb-2 line-clamp-3">{item.body}</p>
                        <div className="flex items-center gap-4 text-xs text-[var(--text-dim)] flex-wrap">
                          <span>{createdDate}</span>
                          <span>{audienceLabel(item.audience)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 text-xs text-[var(--text-muted)]" title="Staff who have read this">
                        <Eye className="w-3.5 h-3.5" />
                        <span>{readCount}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
