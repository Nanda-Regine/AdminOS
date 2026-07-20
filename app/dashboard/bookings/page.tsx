import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { TopBar } from '@/components/dashboard/TopBar'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ConfirmSubmit } from '@/components/ui/ConfirmSubmit'
import { EmptyState } from '@/components/ui/EmptyState'
import { redirect } from 'next/navigation'
import { Calendar } from 'lucide-react'

const statusVariant: Record<string, 'green' | 'yellow' | 'red' | 'gray' | 'blue'> = {
  confirmed: 'green',
  pending: 'yellow',
  cancelled: 'red',
  completed: 'blue',
  no_show: 'gray',
}

function getWeekBounds() {
  const now = new Date()
  const day = now.getDay() // 0=Sun
  const monday = new Date(now)
  monday.setDate(now.getDate() - ((day + 6) % 7))
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)
  return {
    start: monday.toISOString().slice(0, 10),
    end: sunday.toISOString().slice(0, 10),
    todayStr: now.toISOString().slice(0, 10),
  }
}

function formatTime(datetime: string | null): string {
  if (!datetime) return '—'
  try {
    return new Date(datetime).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return datetime
  }
}

export default async function BookingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const tenantId = user.app_metadata?.tenant_id as string
  const { start, end, todayStr } = getWeekBounds()

  const [bookingsResult, servicesResult] = await Promise.all([
    supabaseAdmin
      .from('bookings')
      .select('*, booking_services(service_name:name, duration_minutes, price)')
      .eq('tenant_id', tenantId)
      .gte('booking_date', start)
      .lte('booking_date', end)
      .order('booking_date')
      .order('start_time'),
    supabaseAdmin
      .from('booking_services')
      .select('id, service_name:name, duration_minutes, price')
      .eq('tenant_id', tenantId)
      .order('name'),
  ])

  const bookings = bookingsResult.data || []
  const services = servicesResult.data || []

  const todayBookings = bookings.filter(b => b.booking_date === todayStr)
  const confirmedCount = bookings.filter(b => b.status === 'confirmed').length
  const pendingCount = bookings.filter(b => b.status === 'pending').length
  const cancelledCount = bookings.filter(b => b.status === 'cancelled').length

  return (
    <div>
      <TopBar title="Bookings" subtitle={`Week of ${start}`} />
      <div className="p-6 space-y-6">

        {/* Week summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <p className="text-xs text-[var(--text-muted)]">This Week</p>
            <p className="text-2xl font-bold text-[var(--text-primary)] mt-1">{bookings.length}</p>
          </Card>
          <Card>
            <p className="text-xs text-[var(--text-muted)]">Confirmed</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{confirmedCount}</p>
          </Card>
          <Card>
            <p className="text-xs text-[var(--text-muted)]">Pending</p>
            <p className="text-2xl font-bold text-yellow-600 mt-1">{pendingCount}</p>
          </Card>
          <Card>
            <p className="text-xs text-[var(--text-muted)]">Cancelled</p>
            <p className="text-2xl font-bold text-red-500 mt-1">{cancelledCount}</p>
          </Card>
        </div>

        {/* Today's bookings */}
        <Card padding="none">
          <div className="p-5 border-b border-[var(--border)] flex items-center justify-between">
            <h3 className="font-semibold text-[var(--text-primary)]">Today&apos;s Bookings</h3>
            <span className="text-xs text-[var(--text-dim)]">{todayStr}</span>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {todayBookings.length === 0 && (
              <p className="px-5 py-8 text-center text-sm text-[var(--text-dim)]">No bookings today.</p>
            )}
            {todayBookings.map((booking) => {
              const service = Array.isArray(booking.booking_services)
                ? booking.booking_services[0]
                : booking.booking_services
              return (
                <div key={booking.id} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-4">
                    <div className="text-center w-14 shrink-0">
                      <p className="text-sm font-bold text-[var(--text-primary)]">{formatTime(booking.start_time)}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[var(--text-primary)]">
                        {service?.service_name || booking.service_name || 'Appointment'}
                      </p>
                      <p className="text-xs text-[var(--text-muted)]">
                        {booking.contact_name || '—'}
                        {booking.staff_name && <span> · {booking.staff_name}</span>}
                      </p>
                    </div>
                  </div>
                  <Badge variant={statusVariant[booking.status] || 'gray'}>
                    {booking.status?.replace('_', ' ') || 'pending'}
                  </Badge>
                </div>
              )
            })}
          </div>
        </Card>

        {/* Full week table */}
        <Card padding="none">
          <div className="p-5 border-b border-[var(--border)]">
            <h3 className="font-semibold text-[var(--text-primary)]">Week Schedule ({start} – {end})</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--surface-2)]">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Date &amp; Time</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Service</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Contact</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Staff</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Status</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {bookings.map((booking) => {
                  const service = Array.isArray(booking.booking_services)
                    ? booking.booking_services[0]
                    : booking.booking_services
                  return (
                    <tr key={booking.id} className="hover:bg-[var(--surface-hover)] transition-colors">
                      <td className="px-5 py-3">
                        <p className="font-medium text-[var(--text-primary)]">{booking.booking_date}</p>
                        <p className="text-xs text-[var(--text-dim)]">{formatTime(booking.start_time)}</p>
                      </td>
                      <td className="px-5 py-3 text-[var(--text-secondary)]">
                        {service?.service_name || booking.service_name || '—'}
                      </td>
                      <td className="px-5 py-3 text-[var(--text-secondary)]">{booking.contact_name || '—'}</td>
                      <td className="px-5 py-3 text-[var(--text-muted)]">{booking.staff_name || '—'}</td>
                      <td className="px-5 py-3">
                        <Badge variant={statusVariant[booking.status] || 'gray'}>
                          {booking.status?.replace('_', ' ') || 'pending'}
                        </Badge>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex gap-3">
                          {booking.status === 'pending' && (
                            <form action={`/api/bookings/${booking.id}/confirm`} method="POST">
                              <button type="submit" className="text-xs text-emerald-700 hover:underline">
                                Confirm
                              </button>
                            </form>
                          )}
                          {booking.status !== 'cancelled' && booking.status !== 'completed' && (
                            <form action={`/api/bookings/${booking.id}/cancel`} method="POST">
                              <ConfirmSubmit
                                label="Cancel"
                                variant="danger"
                                title="Cancel this booking?"
                                description="This cancels the booking. The customer should be notified separately."
                                confirmLabel="Cancel booking"
                                className="text-xs text-[#F87171] hover:underline"
                              />
                            </form>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {bookings.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-6">
                      <EmptyState
                        compact
                        icon={Calendar}
                        title="No bookings this week"
                        body="Bookings appear here once customers reserve a slot through your booking link or WhatsApp. Set up your services and share the link to start taking them."
                        action={{ label: 'Set up bookings', href: '/dashboard/settings/onboarding' }}
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Services offered */}
        {services.length > 0 && (
          <Card>
            <h3 className="font-semibold text-[var(--text-primary)] mb-4">Services Offered ({services.length})</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {services.map((svc) => (
                <div key={svc.id} className="p-3 bg-[var(--surface-2)] rounded-lg">
                  <p className="text-sm font-medium text-[var(--text-primary)]">{svc.service_name}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-[var(--text-dim)]">{svc.duration_minutes} min</span>
                    <span className="text-xs font-semibold text-emerald-600">
                      R{Number(svc.price || 0).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
