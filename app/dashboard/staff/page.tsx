import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { TopBar } from '@/components/dashboard/TopBar'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { redirect } from 'next/navigation'

function WellnessDot({ score }: { score: number }) {
  const color =
    score >= 4 ? 'bg-emerald-500' :
    score >= 3 ? 'bg-yellow-400' :
    score >= 2 ? 'bg-orange-400' : 'bg-red-500'
  return <span className={`inline-block w-2 h-2 rounded-full ${color}`} />
}

export default async function StaffPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const tenantId = user.user_metadata?.tenant_id as string

  const [staffResult, leaveResult] = await Promise.all([
    supabaseAdmin
      .from('staff')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('full_name'),
    supabaseAdmin
      .from('leave_requests')
      .select('*, staff(full_name)')
      .eq('tenant_id', tenantId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false }),
  ])

  const staff = staffResult.data || []
  const pendingLeave = leaveResult.data || []

  return (
    <div>
      <TopBar title="Staff" subtitle={`${staff.length} team members`} />
      <div className="p-6 space-y-6">

        {/* Pending leave requests */}
        {pendingLeave.length > 0 && (
          <Card>
            <h3 className="font-semibold text-gray-900 mb-4">Pending Leave Requests ({pendingLeave.length})</h3>
            <div className="space-y-2">
              {pendingLeave.map((req) => (
                <div key={req.id} className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {(req.staff as { full_name: string } | null)?.full_name || 'Staff member'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {req.start_date} → {req.end_date} ({req.days} days) · {req.reason}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <form action={`/api/leave/${req.id}/approve`} method="POST">
                      <button className="text-xs bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-700">
                        Approve
                      </button>
                    </form>
                    <form action={`/api/leave/${req.id}/decline`} method="POST">
                      <button className="text-xs bg-red-50 text-red-700 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-100">
                        Decline
                      </button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Wellness heatmap */}
        {staff.length > 0 && (
          <Card>
            <h3 className="font-semibold text-gray-900 mb-1">Team Wellness Heatmap</h3>
            <p className="text-xs text-gray-400 mb-4">Last 8 check-in scores per staff member. Color = score (red ≤ 2, orange = 3, yellow = 4, green = 5)</p>
            <div className="overflow-x-auto">
              <div className="min-w-max">
                {staff.map((member) => {
                  const scores = (member.wellness_scores || []) as Array<{ score: number; date: string }>
                  const last8  = scores.slice(-8)
                  const recentAvg = last8.length > 0
                    ? last8.reduce((a, b) => a + b.score, 0) / last8.length
                    : null
                  const isAtRisk  = recentAvg !== null && recentAvg <= 2.5

                  return (
                    <div key={member.id} className="flex items-center gap-3 mb-2">
                      <div className={`w-28 shrink-0 text-xs font-medium truncate ${isAtRisk ? 'text-red-600' : 'text-gray-700'}`}>
                        {member.full_name.split(' ')[0]}
                        {isAtRisk && <span className="ml-1 text-red-500">⚠</span>}
                      </div>
                      <div className="flex gap-1">
                        {last8.length === 0 ? (
                          <span className="text-xs text-gray-300">No check-ins recorded</span>
                        ) : (
                          last8.map((entry, i) => {
                            const color =
                              entry.score >= 5 ? 'bg-emerald-500' :
                              entry.score >= 4 ? 'bg-emerald-300' :
                              entry.score >= 3 ? 'bg-yellow-400' :
                              entry.score >= 2 ? 'bg-orange-400' : 'bg-red-500'
                            return (
                              <div
                                key={i}
                                title={`${entry.date}: ${entry.score}/5`}
                                className={`w-6 h-6 rounded-sm ${color} cursor-default`}
                              />
                            )
                          })
                        )}
                      </div>
                      {recentAvg !== null && (
                        <span className={`text-xs font-semibold shrink-0 ${
                          recentAvg >= 4 ? 'text-emerald-600' :
                          recentAvg >= 3 ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {recentAvg.toFixed(1)}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </Card>
        )}

        {/* Staff grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {staff.map((member) => {
            const scores = (member.wellness_scores || []) as Array<{ score: number; date: string }>
            const latestScore = scores[scores.length - 1]?.score
            const recentAvg = scores.length > 0
              ? scores.slice(-7).reduce((a, b) => a + b.score, 0) / Math.min(scores.slice(-7).length, 7)
              : null

            return (
              <Card key={member.id}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-700 font-semibold">
                      {member.full_name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{member.full_name}</p>
                      <p className="text-xs text-gray-500">{member.role || 'Staff'} · {member.department || 'General'}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {latestScore !== undefined && <WellnessDot score={latestScore} />}
                    {member.after_hours_flag && (
                      <Badge variant="yellow">After hours</Badge>
                    )}
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-gray-50 rounded-lg p-2">
                    <p className="text-gray-500">Leave balance</p>
                    <p className="font-semibold text-gray-800">{member.leave_balance - member.leave_taken} days</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-2">
                    <p className="text-gray-500">Wellness (7d avg)</p>
                    <p className="font-semibold text-gray-800">
                      {recentAvg !== null ? `${recentAvg.toFixed(1)} / 5` : 'No data'}
                    </p>
                  </div>
                </div>

                {member.phone && (
                  <p className="mt-2 text-xs text-gray-400">{member.phone}</p>
                )}
              </Card>
            )
          })}

          {staff.length === 0 && (
            <div className="col-span-3 text-center py-12 text-gray-400">
              <p className="text-3xl mb-2">👥</p>
              <p className="text-sm">No staff added yet. Add team members in Settings.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
