import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { TopBar } from '@/components/dashboard/TopBar'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { redirect } from 'next/navigation'
import { Users, Clock, CalendarOff, Calendar } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function TeamPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const tenantId = user.user_metadata?.tenant_id as string

  const todayISO = new Date().toISOString().slice(0, 10)
  const sevenDaysLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const [staffResult, leaveResult, clockResult, shiftResult, onLeaveResult] = await Promise.all([
    supabaseAdmin
      .from('staff')
      .select('id, full_name, role, department, phone, employment_status')
      .eq('tenant_id', tenantId)
      .order('full_name'),
    supabaseAdmin
      .from('leave_requests')
      .select('*, staff(full_name)')
      .eq('tenant_id', tenantId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('clock_events')
      .select('staff_id, event_type, created_at')
      .eq('tenant_id', tenantId)
      .gte('created_at', todayISO + 'T00:00:00Z')
      .lte('created_at', todayISO + 'T23:59:59Z')
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('shifts')
      .select('id, staff_id, shift_date, start_time, end_time, staff(full_name)')
      .eq('tenant_id', tenantId)
      .gte('shift_date', todayISO)
      .lte('shift_date', sevenDaysLater)
      .order('shift_date'),
    supabaseAdmin
      .from('leave_requests')
      .select('staff_id')
      .eq('tenant_id', tenantId)
      .eq('status', 'approved')
      .lte('start_date', todayISO)
      .gte('end_date', todayISO),
  ])

  const staff = staffResult.data || []
  const pendingLeave = leaveResult.data || []
  const clockEvents = clockResult.data || []
  const shifts = shiftResult.data || []
  const onLeaveToday = onLeaveResult.data || []

  // Build per-staff latest clock event map
  const latestClockMap: Record<string, { event_type: string; created_at: string }> = {}
  for (const evt of clockEvents) {
    if (!latestClockMap[evt.staff_id]) {
      latestClockMap[evt.staff_id] = { event_type: evt.event_type, created_at: evt.created_at }
    }
  }

  const onLeaveIds = new Set(onLeaveToday.map((r) => r.staff_id))
  const clockedInIds = new Set(
    Object.entries(latestClockMap)
      .filter(([, v]) => v.event_type === 'clock_in')
      .map(([id]) => id)
  )

  function getStaffStatus(staffId: string): { label: string; variant: 'green' | 'yellow' | 'gray' | 'red' } {
    if (onLeaveIds.has(staffId)) return { label: 'On Leave', variant: 'yellow' }
    if (clockedInIds.has(staffId)) return { label: 'Clocked In', variant: 'green' }
    return { label: 'Clocked Out', variant: 'gray' }
  }

  return (
    <div>
      <TopBar
        title="Team"
        subtitle={`${staff.length} team member${staff.length !== 1 ? 's' : ''}`}
      />
      <div className="p-6 space-y-6">

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                <Users className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{staff.length}</p>
                <p className="text-xs text-gray-500">Total Staff</p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                <Clock className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{clockedInIds.size}</p>
                <p className="text-xs text-gray-500">Clocked In Today</p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-yellow-100 rounded-xl flex items-center justify-center">
                <CalendarOff className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{onLeaveIds.size}</p>
                <p className="text-xs text-gray-500">On Leave Today</p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                <Calendar className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{shifts.length}</p>
                <p className="text-xs text-gray-500">Shifts (Next 7 Days)</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Pending leave requests */}
        {pendingLeave.length > 0 && (
          <Card>
            <h3 className="font-semibold text-gray-900 mb-4">
              Pending Leave Requests ({pendingLeave.length})
            </h3>
            <div className="space-y-2">
              {pendingLeave.map((req) => (
                <div
                  key={req.id}
                  className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg border border-yellow-200"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {(req.staff as { full_name: string } | null)?.full_name || 'Staff member'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {req.start_date} &rarr; {req.end_date}
                      {req.days ? ` (${req.days} days)` : ''}
                      {req.reason ? ` · ${req.reason}` : ''}
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

        {/* Upcoming shifts */}
        {shifts.length > 0 && (
          <Card>
            <h3 className="font-semibold text-gray-900 mb-4">Upcoming Shifts (Next 7 Days)</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                    <th className="pb-2 font-medium">Staff Member</th>
                    <th className="pb-2 font-medium">Date</th>
                    <th className="pb-2 font-medium">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {shifts.map((shift) => (
                    <tr key={shift.id} className="hover:bg-gray-50">
                      <td className="py-2 font-medium text-gray-900">
                        {(shift.staff as unknown as { full_name: string } | null)?.full_name || 'Staff'}
                      </td>
                      <td className="py-2 text-gray-600">{shift.shift_date}</td>
                      <td className="py-2 text-gray-500">
                        {shift.start_time} &ndash; {shift.end_time}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Staff grid */}
        <div>
          <h3 className="font-semibold text-gray-900 mb-3">All Team Members</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {staff.map((member) => {
              const status = getStaffStatus(member.id)
              const lastEvent = latestClockMap[member.id]
              return (
                <Card key={member.id}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-semibold text-sm">
                        {member.full_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">{member.full_name}</p>
                        <p className="text-xs text-gray-500">
                          {member.role || 'Staff'} &middot; {member.department || 'General'}
                        </p>
                      </div>
                    </div>
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </div>
                  {lastEvent && (
                    <p className="mt-3 text-xs text-gray-400">
                      Last event:{' '}
                      <span className="capitalize">{lastEvent.event_type.replace('_', ' ')}</span>{' '}
                      at{' '}
                      {new Date(lastEvent.created_at).toLocaleTimeString('en-ZA', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  )}
                  {member.phone && (
                    <p className="mt-1 text-xs text-gray-400">{member.phone}</p>
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
    </div>
  )
}
