import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { TopBar } from '@/components/dashboard/TopBar'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { redirect } from 'next/navigation'
import { Megaphone, Eye } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function AnnouncementsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const tenantId = user.app_metadata?.tenant_id as string

  const { data: announcements } = await supabaseAdmin
    .from('announcements')
    .select('id, tenant_id, title, body, priority, channels, target_roles, read_count, created_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(50)

  const items = announcements || []
  const urgentCount = items.filter((a) => a.priority === 'urgent').length

  return (
    <div>
      <TopBar
        title="Announcements"
        subtitle={`${items.length} total · ${urgentCount} urgent`}
      />
      <div className="p-6 space-y-6">

        {/* Create form */}
        <Card>
          <h3 className="font-semibold text-gray-900 mb-4">Create Announcement</h3>
          <form action="/api/announcements" method="POST" className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Title</label>
              <input
                type="text"
                name="title"
                required
                placeholder="Announcement title..."
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Message</label>
              <textarea
                name="body"
                required
                rows={4}
                placeholder="Write your announcement here..."
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Priority</label>
                <select
                  name="priority"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="normal">Normal</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Target Roles</label>
                <input
                  type="text"
                  name="target_roles"
                  placeholder="e.g. all, manager, cashier"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                className="bg-indigo-600 text-white text-sm font-semibold px-5 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Publish Announcement
              </button>
            </div>
          </form>
        </Card>

        {/* Announcements list */}
        <Card>
          <h3 className="font-semibold text-gray-900 mb-4">All Announcements</h3>

          {items.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <p className="text-3xl mb-2">
                <Megaphone className="w-8 h-8 mx-auto text-gray-300" />
              </p>
              <p className="text-sm">No announcements yet. Create one above to notify your team.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => {
                const createdDate = item.created_at
                  ? new Date(item.created_at).toLocaleDateString('en-ZA', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })
                  : '—'

                const channels: string[] = Array.isArray(item.channels)
                  ? item.channels
                  : typeof item.channels === 'string'
                  ? [item.channels]
                  : []

                const targetRoles: string[] = Array.isArray(item.target_roles)
                  ? item.target_roles
                  : typeof item.target_roles === 'string'
                  ? [item.target_roles]
                  : []

                return (
                  <div
                    key={item.id}
                    className={`p-4 rounded-xl border ${
                      item.priority === 'urgent'
                        ? 'bg-red-50 border-red-200'
                        : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <p className="text-sm font-semibold text-gray-900">{item.title}</p>
                          <Badge variant={item.priority === 'urgent' ? 'red' : 'gray'} className="capitalize">
                            {item.priority || 'normal'}
                          </Badge>
                        </div>
                        <p className="text-xs text-gray-600 mb-2 line-clamp-3">{item.body}</p>
                        <div className="flex items-center gap-4 text-xs text-gray-400 flex-wrap">
                          <span>{createdDate}</span>
                          {channels.length > 0 && (
                            <span>Channels: {channels.join(', ')}</span>
                          )}
                          {targetRoles.length > 0 && (
                            <span>Roles: {targetRoles.join(', ')}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 text-xs text-gray-500">
                        <Eye className="w-3.5 h-3.5" />
                        <span>{item.read_count ?? 0}</span>
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
