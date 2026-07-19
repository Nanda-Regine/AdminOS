import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { TopBar } from '@/components/dashboard/TopBar'
import { CreateShiftModal } from './CreateShiftModal'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ConfirmSubmit } from '@/components/ui/ConfirmSubmit'
import { redirect } from 'next/navigation'
import { Users, Clock, CalendarOff, Calendar } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function TeamPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const tenantId = user.app_metadata?.tenant_id as string

  // Use SAST (UTC+2) for date calculations — clocking happens in South African time
  const sast = new Date(Date.now() + 2 * 3600000)
  const todayISO = sast.toISOString().slice(0, 10)
  const sevenDaysLater = new Date(Date.now() + 2 * 3600000 + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const [staffResult, leaveResult, clockResult, shiftResult, onLeaveResult] = await Promise.all([
    supabaseAdmin
      .from('staff')
      .select('id, full_name, role, department, phone, employment_type, active')
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
      .gte('created_at', todayISO + 'T00:00:00+02:00')
      .lte('created_at', todayISO + 'T23:59:59+02:00')
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
        actions={<CreateShiftModal staff={staff.map((s) => ({ id: s.id as string, full_name: (s.full_name as string) ?? null }))} />}
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
                <p className="text-2xl font-bold text-[var(--text-primary)]">{staff.length}</p>
                <p className="text-xs text-[var(--text-muted)]">Total Staff</p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                <Clock className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[var(--text-primary)]">{clockedInIds.size}</p>
                <p className="text-xs text-[var(--text-muted)]">Clocked In Today</p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-yellow-100 rounded-xl flex items-center justify-center">
                <CalendarOff className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[var(--text-primary)]">{onLeaveIds.size}</p>
                <p className="text-xs text-[var(--text-muted)]">On Leave Today</p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                <Calendar className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[var(--text-primary)]">{shifts.length}</p>
                <p className="text-xs text-[var(--text-muted)]">Shifts (Next 7 Days)</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Pending leave requests */}
        {pendingLeave.length > 0 && (
          <Card>
            <h3 className="font-semibold text-[var(--text-primary)] mb-4">
              Pending Leave Requests ({pendingLeave.length})
            </h3>
            <div className="space-y-2">
              {pendingLeave.map((req) => (
                <div
                  key={req.id}
                  className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg border border-yellow-200"
                >
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">
                      {(req.staff as { full_name: string } | null)?.full_name || 'Staff member'}
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {req.start_date} &rarr; {req.end_date}
                      {req.days ? ` (${req.days} days)` : ''}
                      {req.reason ? ` · ${req.reason}` : ''}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <form action={`/api/leave/${req.id}/approve`} method="POST">
                      <ConfirmSubmit
                        label="Approve"
                        title="Approve this leave request?"
                        description="This approves the leave and updates the staff member's leave balance."
                        confirmLabel="Approve leave"
                        className="text-xs bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-700"
                      />
                    </form>
                    <form action={`/api/leave/${req.id}/decline`} method="POST">
                      <ConfirmSubmit
                        label="Decline"
                        variant="danger"
                        title="Decline this leave request?"
                        description="This declines the request. The staff member will be notified and can reapply."
                        confirmLabel="Decline leave"
                        className="text-xs bg-[rgba(239,68,68,0.12)] text-[#F87171] border border-[rgba(239,68,68,0.3)] px-3 py-1.5 rounded-lg hover:bg-[rgba(239,68,68,0.2)]"
                      />
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
            <h3 className="font-semibold text-[var(--text-primary)] mb-4">Upcoming Shifts (Next 7 Days)</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-[var(--text-muted)] border-b border-[var(--border)]">
                    <th className="pb-2 font-medium">Staff Member</th>
                    <th className="pb-2 font-medium">Date</th>
                    <th className="pb-2 font-medium">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {shifts.map((shift) => (
                    <tr key={shift.id} className="hover:bg-[var(--surface-hover)]">
                      <td className="py-2 font-medium text-[var(--text-primary)]">
                        {(shift.staff as unknown as { full_name: string } | null)?.full_name || 'Staff'}
                      </td>
                      <td className="py-2 text-[var(--text-muted)]">{shift.shift_date}</td>
                      <td className="py-2 text-[var(--text-muted)]">
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
          <h3 className="font-semibold text-[var(--text-primary)] mb-3">All Team Members</h3>
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
                        <p className="font-semibold text-[var(--text-primary)] text-sm">{member.full_name}</p>
                        <p className="text-xs text-[var(--text-muted)]">
                          {member.role || 'Staff'} &middot; {member.department || 'General'}
                        </p>
                      </div>
                    </div>
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </div>
                  {lastEvent && (
                    <p className="mt-3 text-xs text-[var(--text-dim)]">
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
                    <p className="mt-1 text-xs text-[var(--text-dim)]">{member.phone}</p>
                  )}
                </Card>
              )
            })}

            {staff.length === 0 && (
              <div className="col-span-3 text-center py-12 text-[var(--text-dim)]">
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
