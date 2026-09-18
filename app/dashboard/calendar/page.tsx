import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/dashboard/TopBar'
import { Card } from '@/components/ui/card'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { redirect, notFound } from 'next/navigation'
import { checkPermission } from '@/lib/auth/permissions'
import { buildMonthGrid, monthGridRange, monthLabel, parseMonthParam, adjacentMonthParam } from '@/lib/calendar/monthGrid'
import { getCalendarEvents, groupEventsByDate, EVENT_STYLE, type CalendarEvent } from '@/lib/calendar/events'

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

function formatDayHeading(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00Z').toLocaleDateString('en-ZA', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  })
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; day?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // A unified business calendar mixes staff leave (HR data colleagues
  // shouldn't browse), invoices due and contract/licence expiry (financial),
  // and bookings (customer data) — approve_leave is the permission that
  // already separates every internal role from the client role, matching
  // the dominant sensitivity of what's shown here.
  if (!(await checkPermission('approve_leave'))) notFound()

  const tenantId = user.app_metadata?.tenant_id as string
  const today = todayStr()
  const params = await searchParams

  const { year, month } = parseMonthParam(params.month, today)
  const weeks = buildMonthGrid(year, month, today)
  const { from, to } = monthGridRange(weeks)
  const firstOfDisplayedMonth = `${year}-${String(month + 1).padStart(2, '0')}-01`

  const events = await getCalendarEvents(tenantId, from, to)
  const byDate = groupEventsByDate(events)

  const selectedDay = params.day && byDate.has(params.day)
    ? params.day
    : (weeks.some(w => w.some(d => d.date === today && d.isCurrentMonth)) ? today : firstOfDisplayedMonth)
  const selectedEvents = byDate.get(selectedDay) ?? []

  const prevMonth = adjacentMonthParam(year, month, -1)
  const nextMonth = adjacentMonthParam(year, month, 1)
  const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  return (
    <div>
      <TopBar title="Calendar" subtitle="Leave, bookings, invoices due, and compliance deadlines — all in one view" />
      <div className="p-4 md:p-6 space-y-6">

        <Card padding="none">
          {/* Month nav */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
            <Link
              href={`/dashboard/calendar?month=${prevMonth}`}
              className="p-2 rounded-lg hover:bg-[var(--surface-2)] text-[var(--text-muted)]"
              aria-label="Previous month"
            >
              <ChevronLeft className="w-4 h-4" />
            </Link>
            <h3 className="font-semibold text-[var(--text-primary)]">{monthLabel(year, month)}</h3>
            <Link
              href={`/dashboard/calendar?month=${nextMonth}`}
              className="p-2 rounded-lg hover:bg-[var(--surface-2)] text-[var(--text-muted)]"
              aria-label="Next month"
            >
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          {/* 7 fixed columns don't fit a phone screen — scroll horizontally
              below md: rather than squeezing cells unreadably thin. */}
          <div className="overflow-x-auto">
          <div className="min-w-[640px]">
          {/* Weekday header */}
          <div className="grid grid-cols-7 border-b border-[var(--border)] bg-[var(--surface-2)]">
            {WEEKDAY_LABELS.map((d) => (
              <div key={d} className="px-2 py-2 text-center text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">
                {d}
              </div>
            ))}
          </div>

          {/* Month grid */}
          <div className="divide-y divide-[var(--border)]">
            {weeks.map((week) => (
              <div key={week[0].date} className="grid grid-cols-7 divide-x divide-[var(--border)]">
                {week.map((day) => {
                  const dayEvents = byDate.get(day.date) ?? []
                  const shown = dayEvents.slice(0, 3)
                  const overflow = dayEvents.length - shown.length
                  const isSelected = day.date === selectedDay
                  return (
                    <Link
                      key={day.date}
                      href={`/dashboard/calendar?month=${year}-${String(month + 1).padStart(2, '0')}&day=${day.date}`}
                      className={[
                        'min-h-[92px] p-1.5 flex flex-col gap-1 text-left transition-colors',
                        day.isCurrentMonth ? 'bg-[var(--surface)]' : 'bg-[var(--surface-2)] opacity-50',
                        isSelected ? 'ring-2 ring-inset ring-[var(--indigo-light)]' : 'hover:bg-[var(--surface-hover)]',
                      ].join(' ')}
                    >
                      <span
                        className={[
                          'text-xs w-6 h-6 flex items-center justify-center rounded-full shrink-0',
                          day.isToday ? 'bg-[var(--indigo-light)] text-white font-bold' : 'text-[var(--text-muted)]',
                        ].join(' ')}
                      >
                        {day.dayOfMonth}
                      </span>
                      <div className="flex flex-col gap-0.5 min-w-0">
                        {shown.map((e) => (
                          <span
                            key={e.id}
                            className="flex items-center gap-1 text-[10px] leading-tight truncate"
                            title={e.title}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${EVENT_STYLE[e.type].dot}`} />
                            <span className="truncate text-[var(--text-secondary)]">{e.title}</span>
                          </span>
                        ))}
                        {overflow > 0 && (
                          <span className="text-[10px] text-[var(--text-dim)] pl-2.5">+{overflow} more</span>
                        )}
                      </div>
                    </Link>
                  )
                })}
              </div>
            ))}
          </div>
          </div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-x-4 gap-y-2 px-5 py-3 border-t border-[var(--border)]">
            {Object.entries(EVENT_STYLE).map(([type, style]) => (
              <span key={type} className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                <span className={`w-2 h-2 rounded-full ${style.dot}`} />
                {style.label}
              </span>
            ))}
          </div>
        </Card>

        {/* Selected day detail */}
        <Card padding="none">
          <div className="p-5 border-b border-[var(--border)]">
            <h3 className="font-semibold text-[var(--text-primary)]">{formatDayHeading(selectedDay)}</h3>
          </div>
          {selectedEvents.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-[var(--text-dim)]">Nothing on the calendar this day.</p>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {selectedEvents.map((e: CalendarEvent) => (
                <Link
                  key={e.id}
                  href={e.href ?? '#'}
                  className="flex items-center justify-between px-5 py-3 hover:bg-[var(--surface-hover)] transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${EVENT_STYLE[e.type].dot}`} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[var(--text-primary)] truncate">{e.title}</p>
                      {e.subtitle && <p className="text-xs text-[var(--text-muted)] truncate">{e.subtitle}</p>}
                    </div>
                  </div>
                  <span className={`shrink-0 text-xs px-2 py-1 rounded-full border ${EVENT_STYLE[e.type].chip}`}>
                    {e.time ?? EVENT_STYLE[e.type].label}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
