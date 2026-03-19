import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { TopBar } from '@/components/dashboard/TopBar'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { redirect } from 'next/navigation'

export default async function CalendarPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const tenantId = user.user_metadata?.tenant_id as string

  const today = new Date()
  const thirtyDaysAhead = new Date()
  thirtyDaysAhead.setDate(thirtyDaysAhead.getDate() + 30)

  const todayStr           = today.toISOString().split('T')[0]
  const thirtyDaysAheadStr = thirtyDaysAhead.toISOString().split('T')[0]

  const [leaveResult, invoiceResult] = await Promise.all([
    supabaseAdmin
      .from('leave_requests')
      .select('*, staff(full_name)')
      .eq('tenant_id', tenantId)
      .gte('start_date', todayStr)
      .lte('end_date', thirtyDaysAheadStr)
      .order('start_date'),
    supabaseAdmin
      .from('invoices')
      .select('id, contact_name, amount, due_date, status')
      .eq('tenant_id', tenantId)
      .in('status', ['unpaid', 'partial'])
      .gte('due_date', todayStr)
      .lte('due_date', thirtyDaysAheadStr)
      .order('due_date'),
  ])

  const leaveRequests  = leaveResult.data   || []
  const upcomingDue    = invoiceResult.data  || []
  const approvedLeave  = leaveRequests.filter((r) => r.status === 'approved')
  const pendingLeave   = leaveRequests.filter((r) => r.status === 'pending')

  const statusVariant: Record<string, 'green' | 'yellow' | 'red'> = {
    approved: 'green',
    pending: 'yellow',
    declined: 'red',
  }

  return (
    <div>
      <TopBar title="Calendar" subtitle="Leave and appointments — next 30 days" />
      <div className="p-6 space-y-6">

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Approved leave */}
          <Card>
            <h3 className="font-semibold text-gray-900 mb-4">Approved Leave</h3>
            {approvedLeave.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">No approved leave in the next 30 days.</p>
            ) : (
              <div className="space-y-2">
                {approvedLeave.map((req) => (
                  <div key={req.id} className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {(req.staff as { full_name: string } | null)?.full_name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {req.start_date} → {req.end_date} ({req.days} days)
                      </p>
                    </div>
                    <Badge variant="green">Approved</Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Pending leave */}
          <Card>
            <h3 className="font-semibold text-gray-900 mb-4">Pending Approval</h3>
            {pendingLeave.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">No pending leave requests.</p>
            ) : (
              <div className="space-y-2">
                {pendingLeave.map((req) => (
                  <div key={req.id} className="flex items-center justify-between p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {(req.staff as { full_name: string } | null)?.full_name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {req.start_date} → {req.end_date} · {req.reason}
                      </p>
                    </div>
                    <Badge variant="yellow">Pending</Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Upcoming invoice due dates */}
        {upcomingDue.length > 0 && (
          <Card>
            <h3 className="font-semibold text-gray-900 mb-4">Invoices Due — Next 30 Days</h3>
            <div className="space-y-2">
              {upcomingDue.map((inv) => {
                const daysUntil = Math.floor(
                  (new Date(inv.due_date + 'T12:00:00').getTime() - today.getTime()) / 86_400_000
                )
                return (
                  <div key={inv.id} className="flex items-center justify-between p-3 bg-orange-50 border border-orange-200 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{inv.contact_name}</p>
                      <p className="text-xs text-gray-500">Due {inv.due_date} · R{Number(inv.amount).toLocaleString()}</p>
                    </div>
                    <Badge variant={daysUntil <= 3 ? 'red' : 'yellow'}>
                      {daysUntil === 0 ? 'Due today' : daysUntil === 1 ? 'Due tomorrow' : `${daysUntil}d left`}
                    </Badge>
                  </div>
                )
              })}
            </div>
          </Card>
        )}

        {/* All requests table */}
        <Card padding="none">
          <div className="p-5 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">All Leave Requests</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Staff Member</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Dates</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Days</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Reason</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {leaveRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium text-gray-900">
                      {(req.staff as { full_name: string } | null)?.full_name}
                    </td>
                    <td className="px-5 py-3 text-gray-600">{req.start_date} → {req.end_date}</td>
                    <td className="px-5 py-3 text-gray-600">{req.days}</td>
                    <td className="px-5 py-3 text-gray-500">{req.reason || '—'}</td>
                    <td className="px-5 py-3">
                      <Badge variant={statusVariant[req.status] || 'gray'}>
                        {req.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
                {leaveRequests.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-gray-400 text-sm">
                      No leave requests in the next 30 days.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  )
}
