import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { TopBar } from '@/components/dashboard/TopBar'
import type { Context } from '@/lib/auth/context'
import { canSeeAnnouncement } from '@/lib/people/announcements'
import { FEATURES, canOpenFeature } from '@/lib/nav/features'
import { sastDate, sastDayStartUTC, sastHour, sastDateLabel, greetingFor } from '@/lib/time/sast'
import {
  ArrowRight, ClipboardList, CalendarClock, Clock, Megaphone, BookOpen, Plane, CheckCircle2, UserCircle2,
} from 'lucide-react'

/**
 * The Command Center for people who don't run the business: staff, field
 * agents and clients. It used to render the owner's full cockpit — debtors,
 * net position, runway, contracts, compliance — to every login, read through
 * the admin client, so a driver saw what the business was owed and by whom.
 *
 * This shows only the caller's own day: their tasks, bookings and shifts,
 * their leave, today's clock status, announcements meant for them, and
 * policies waiting for their acknowledgement.
 */
export async function MyDay({ ctx, firstName }: { ctx: Context; firstName: string }) {
  const today = sastDate()
  const dayStart = sastDayStartUTC(today)
  const dayEnd = new Date(new Date(dayStart).getTime() + 86400000).toISOString()

  const { data: me } = await supabaseAdmin
    .from('staff')
    .select('id, full_name, job_title, leave_balance, leave_taken')
    .eq('tenant_id', ctx.tenantId)
    .eq('user_id', ctx.userId)
    .is('deleted_at', null)
    .maybeSingle()
  const staffId = me?.id ?? null

  const none = { data: [] as never[] }
  const [taskRes, bookingRes, shiftRes, leaveRes, clockRes, annRes, sopRes, ackRes] = await Promise.all([
    staffId
      ? supabaseAdmin.from('tasks').select('id, title, status, priority, due_date')
          .eq('tenant_id', ctx.tenantId).eq('assigned_to', staffId).is('deleted_at', null)
          .not('status', 'in', '("done","completed","cancelled")')
          .order('due_date', { ascending: true, nullsFirst: false }).limit(8)
      : none,
    staffId
      ? supabaseAdmin.from('bookings').select('id, start_at, status, contacts(full_name), booking_services(name)')
          .eq('tenant_id', ctx.tenantId).eq('staff_id', staffId).is('deleted_at', null)
          .neq('status', 'cancelled').gte('start_at', dayStart).lt('start_at', dayEnd)
          .order('start_at').limit(20)
      : none,
    staffId
      ? supabaseAdmin.from('shifts').select('id, shift_date, start_time, end_time, location')
          .eq('tenant_id', ctx.tenantId).eq('staff_id', staffId).is('deleted_at', null)
          .gte('shift_date', today).order('shift_date').limit(5)
      : none,
    staffId
      ? supabaseAdmin.from('leave_requests').select('id, start_date, end_date, days, status, leave_type')
          .eq('tenant_id', ctx.tenantId).eq('staff_id', staffId).is('deleted_at', null)
          .order('created_at', { ascending: false }).limit(3)
      : none,
    staffId
      ? supabaseAdmin.from('clock_events').select('event_type, timestamp')
          .eq('tenant_id', ctx.tenantId).eq('staff_id', staffId)
          .gte('timestamp', dayStart).lt('timestamp', dayEnd)
          .order('timestamp', { ascending: false }).limit(1)
      : none,
    supabaseAdmin.from('announcements').select('id, title, body, audience, audience_ids, pinned, published_at, expires_at')
      .eq('tenant_id', ctx.tenantId).is('deleted_at', null)
      .order('pinned', { ascending: false }).order('published_at', { ascending: false }).limit(30),
    supabaseAdmin.from('sop_documents').select('id, title, applicable_roles')
      .eq('tenant_id', ctx.tenantId).is('deleted_at', null)
      .eq('status', 'active').eq('requires_acknowledgement', true).limit(100),
    supabaseAdmin.from('sop_acknowledgements').select('sop_id').eq('user_id', ctx.userId),
  ])

  const tasks = taskRes.data ?? []
  const bookings = (bookingRes.data ?? []) as unknown as {
    id: string; start_at: string; status: string
    contacts: { full_name: string | null } | null; booking_services: { name: string | null } | null
  }[]
  const shifts = shiftRes.data ?? []
  const leave = leaveRes.data ?? []
  const lastClock = (clockRes.data ?? [])[0] as { event_type: string; timestamp: string } | undefined
  const viewer = { userId: ctx.userId, permissions: ctx.permissions, isSuperAdmin: ctx.isSuperAdmin, staffId }
  const announcements = (annRes.data ?? []).filter(a => canSeeAnnouncement(a, viewer)).slice(0, 4)
  const acked = new Set((ackRes.data ?? []).map(a => a.sop_id))
  const toAck = (sopRes.data ?? []).filter(s =>
    !acked.has(s.id) && (!s.applicable_roles?.length || s.applicable_roles.includes(ctx.role)))

  const clockLabel = { clock_in: 'Clocked in', break_end: 'Back from break', break_start: 'On break since', clock_out: 'Clocked out' }[lastClock?.event_type ?? ''] ?? 'Last clock event'
  const time = (iso: string) => new Date(iso).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Johannesburg' })
  const overdue = (d: string | null) => d != null && d.slice(0, 10) < today
  const shortcuts = FEATURES.filter(f => !f.exact && f.category !== 'Setup' && canOpenFeature(f, ctx.permissions)).slice(0, 8)

  const card = 'glass rounded-2xl p-5'
  const head = (Icon: typeof ClipboardList, label: string, href?: string) => (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4" style={{ color: 'var(--indigo-light)' }} />
        <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{label}</h3>
      </div>
      {href && <Link href={href} className="text-xs font-medium" style={{ color: 'var(--indigo-light)' }}>Open →</Link>}
    </div>
  )
  const empty = (text: string) => <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{text}</p>
  const canBookings = ctx.permissions.includes('manage_contacts')

  return (
    <div className="animate-fade-in">
      <TopBar title="My Day" subtitle={sastDateLabel()} />
      <div className="p-4 md:p-6 space-y-6">
        <div className="rounded-2xl px-6 py-5 border on-dark"
          style={{ background: 'linear-gradient(135deg, #111936 0%, #1a2347 100%)', borderColor: 'var(--border)' }}>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{greetingFor(sastHour())}, {firstName}</p>
          <h2 className="text-xl font-semibold mt-1.5" style={{ color: 'var(--text-primary)' }}>
            {!me
              ? 'Your login is not linked to a staff profile yet.'
              : tasks.length + bookings.length === 0
                ? 'Nothing assigned to you today.'
                : `${tasks.length} open task${tasks.length === 1 ? '' : 's'} · ${bookings.length} booking${bookings.length === 1 ? '' : 's'} today`}
          </h2>
          <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>
            {!me
              ? 'Ask your manager to send you a staff invite code, then redeem it in the AdminOS staff app.'
              : lastClock
                ? `${clockLabel} ${time(lastClock.timestamp)}`
                : 'Not clocked in today. Clock in from the AdminOS staff app.'}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className={card}>
              {head(ClipboardList, 'My tasks', '/dashboard/tasks')}
              {tasks.length === 0 ? empty(me ? 'No open tasks assigned to you.' : 'Tasks appear here once your login is linked to your staff profile.') : (
                <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                  {tasks.map(t => (
                    <div key={t.id} className="flex items-center gap-3 py-2.5">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: t.priority === 'urgent' || t.priority === 'high' ? '#F87171' : 'var(--indigo-light)' }} />
                      <p className="flex-1 text-sm truncate" style={{ color: 'var(--text-primary)' }}>{t.title}</p>
                      {t.due_date && (
                        <span className="text-xs tabular-nums shrink-0" style={{ color: overdue(t.due_date) ? '#F87171' : 'var(--text-muted)' }}>
                          {overdue(t.due_date) ? 'Overdue · ' : ''}{new Date(t.due_date).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', timeZone: 'Africa/Johannesburg' })}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className={card}>
              {head(CalendarClock, 'My bookings today', canBookings ? '/dashboard/bookings' : undefined)}
              {bookings.length === 0 ? empty('No bookings with you today.') : (
                <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                  {bookings.map(b => (
                    <div key={b.id} className="flex items-center gap-3 py-2.5">
                      <span className="text-sm font-semibold tabular-nums w-14 shrink-0" style={{ color: 'var(--text-primary)' }}>{time(b.start_at)}</span>
                      <p className="flex-1 text-sm truncate" style={{ color: 'var(--text-secondary)' }}>
                        {b.contacts?.full_name ?? 'Walk-in'}{b.booking_services?.name ? ` · ${b.booking_services.name}` : ''}
                      </p>
                      <span className="text-xs capitalize" style={{ color: b.status === 'pending' ? '#F59E0B' : 'var(--text-muted)' }}>{b.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className={card}>
              {head(Megaphone, 'Announcements', '/dashboard/announcements')}
              {announcements.length === 0 ? empty('No announcements for you.') : (
                <div className="space-y-3">
                  {announcements.map(a => (
                    <div key={a.id}>
                      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{a.pinned ? '📌 ' : ''}{a.title}</p>
                      <p className="text-xs mt-0.5 line-clamp-2" style={{ color: 'var(--text-muted)' }}>{a.body}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className={card}>
              {head(BookOpen, 'Policies to read', '/dashboard/handbook')}
              {toAck.length === 0 ? (
                <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                  <CheckCircle2 className="w-4 h-4" style={{ color: '#34D399' }} /> You&apos;re up to date.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {toAck.slice(0, 5).map(s => (
                    <Link key={s.id} href="/dashboard/handbook" className="block text-sm hover:underline" style={{ color: 'var(--text-secondary)' }}>{s.title}</Link>
                  ))}
                  {toAck.length > 5 && empty(`+${toAck.length - 5} more`)}
                </div>
              )}
            </div>

            <div className={card}>
              {head(Clock, 'Upcoming shifts')}
              {shifts.length === 0 ? empty('No shifts rostered.') : (
                <div className="space-y-1.5">
                  {shifts.map(s => (
                    <div key={s.id} className="flex justify-between text-sm" style={{ color: 'var(--text-secondary)' }}>
                      <span>{new Date(`${s.shift_date}T12:00:00+02:00`).toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Africa/Johannesburg' })}</span>
                      <span className="tabular-nums">{s.start_time?.slice(0, 5)}–{s.end_time?.slice(0, 5)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className={card}>
              {head(Plane, 'My leave')}
              {me && (
                <p className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>{Number(me.leave_balance ?? 0)}</strong> days annual leave available
                </p>
              )}
              {leave.length === 0 ? empty('No leave requests yet. Apply from the AdminOS staff app.') : (
                <div className="space-y-1.5">
                  {leave.map(l => (
                    <div key={l.id} className="flex justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
                      <span>{l.start_date} → {l.end_date}</span>
                      <span className="capitalize" style={{ color: l.status === 'approved' ? '#34D399' : l.status === 'rejected' ? '#F87171' : '#F59E0B' }}>{String(l.status)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {shortcuts.length > 0 && (
              <div className={card}>
                {head(UserCircle2, 'Your tools')}
                <div className="space-y-1">
                  {shortcuts.map(f => (
                    <Link key={f.href} href={f.href} className="flex items-center justify-between text-sm py-1 hover:underline" style={{ color: 'var(--text-secondary)' }}>
                      <span className="flex items-center gap-2"><f.icon className="w-3.5 h-3.5" />{f.label}</span>
                      <ArrowRight className="w-3 h-3" style={{ color: 'var(--text-dim)' }} />
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
