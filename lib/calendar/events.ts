/**
 * Aggregates every date-bearing business record into one unified calendar
 * feed for /dashboard/calendar. Six sources, all real: leave requests,
 * invoices due, bookings, compliance deadlines, staff licence expiries,
 * contract expiries. Each normalizes to one CalendarEvent per day it should
 * appear on — leave requests span every day in their range, everything else
 * is a single-day event.
 */
import { supabaseAdmin } from '@/lib/supabase/admin'

export type CalendarEventType =
  | 'leave_approved' | 'leave_pending'
  | 'invoice_due'
  | 'booking'
  | 'compliance_due'
  | 'license_expiry'
  | 'contract_expiry'

export interface CalendarEvent {
  id: string
  date: string // YYYY-MM-DD
  type: CalendarEventType
  title: string
  subtitle?: string
  href?: string
  /** Only set for bookings — lets the day panel sort same-day events by time. */
  time?: string
}

export const EVENT_STYLE: Record<CalendarEventType, { label: string; dot: string; chip: string }> = {
  leave_approved:  { label: 'Approved leave',   dot: 'bg-emerald-500', chip: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  leave_pending:   { label: 'Pending leave',     dot: 'bg-amber-500',   chip: 'bg-amber-50 text-amber-700 border-amber-200' },
  invoice_due:     { label: 'Invoice due',       dot: 'bg-orange-500',  chip: 'bg-orange-50 text-orange-700 border-orange-200' },
  booking:         { label: 'Booking',           dot: 'bg-indigo-500',  chip: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  compliance_due:  { label: 'Compliance deadline', dot: 'bg-red-500',   chip: 'bg-red-50 text-red-700 border-red-200' },
  license_expiry:  { label: 'Licence expiry',    dot: 'bg-purple-500',  chip: 'bg-purple-50 text-purple-700 border-purple-200' },
  contract_expiry: { label: 'Contract expiry',   dot: 'bg-slate-500',   chip: 'bg-slate-50 text-slate-700 border-slate-200' },
}

function eachDate(startStr: string, endStr: string): string[] {
  const dates: string[] = []
  const start = new Date(startStr + 'T00:00:00Z')
  const end   = new Date(endStr   + 'T00:00:00Z')
  for (let d = start; d <= end; d = new Date(d.getTime() + 86400000)) {
    dates.push(d.toISOString().slice(0, 10))
  }
  return dates
}

/** All calendar events in [from, to] (inclusive, both YYYY-MM-DD) for one tenant. */
export async function getCalendarEvents(tenantId: string, from: string, to: string): Promise<CalendarEvent[]> {
  const fromISO = `${from}T00:00:00Z`
  const toISO   = `${to}T23:59:59Z`

  const [leaveRes, invoiceRes, bookingRes, complianceRes, licenseRes, contractRes] = await Promise.all([
    supabaseAdmin
      .from('leave_requests')
      .select('id, start_date, end_date, status, reason, staff(full_name)')
      .eq('tenant_id', tenantId)
      .in('status', ['approved', 'pending'])
      .lte('start_date', to)
      .gte('end_date', from),
    supabaseAdmin
      .from('invoices')
      .select('id, contact_name, amount, due_date, status')
      .eq('tenant_id', tenantId)
      .in('status', ['unpaid', 'partial', 'overdue', 'in_collections'])
      .gte('due_date', from)
      .lte('due_date', to),
    supabaseAdmin
      .from('bookings')
      .select('id, start_at, status, service:booking_services(name), contact:contacts(name:full_name)')
      .eq('tenant_id', tenantId)
      .neq('status', 'cancelled')
      .gte('start_at', fromISO)
      .lte('start_at', toISO),
    supabaseAdmin
      .from('compliance_items')
      .select('id, title, due_date, status, item_type')
      .eq('tenant_id', tenantId)
      .in('status', ['upcoming', 'due', 'overdue'])
      .gte('due_date', from)
      .lte('due_date', to),
    supabaseAdmin
      .from('professional_licenses')
      .select('id, license_type, expiry_date, staff(full_name)')
      .eq('tenant_id', tenantId)
      .gte('expiry_date', from)
      .lte('expiry_date', to),
    supabaseAdmin
      .from('contracts')
      .select('id, title, end_date, status, contact:contacts(name:full_name)')
      .eq('tenant_id', tenantId)
      .in('status', ['signed', 'partially_signed'])
      .gte('end_date', from)
      .lte('end_date', to),
  ])

  const events: CalendarEvent[] = []
  const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v)

  for (const req of leaveRes.data ?? []) {
    const staff = one(req.staff as { full_name: string } | { full_name: string }[] | null)
    const start = req.start_date < from ? from : req.start_date
    const end   = req.end_date   > to   ? to   : req.end_date
    for (const date of eachDate(start, end)) {
      events.push({
        id: `leave-${req.id}-${date}`,
        date,
        type: req.status === 'approved' ? 'leave_approved' : 'leave_pending',
        title: staff?.full_name ?? 'Staff leave',
        subtitle: req.reason ?? undefined,
        href: '/dashboard/calendar',
      })
    }
  }

  for (const inv of invoiceRes.data ?? []) {
    if (!inv.due_date) continue
    events.push({
      id: `invoice-${inv.id}`,
      date: inv.due_date,
      type: 'invoice_due',
      title: inv.contact_name ?? 'Invoice due',
      subtitle: `R${Number(inv.amount ?? 0).toLocaleString('en-ZA')}`,
      href: '/dashboard/invoices',
    })
  }

  for (const bk of bookingRes.data ?? []) {
    const service = one(bk.service as { name: string } | { name: string }[] | null)
    const contact = one(bk.contact as { name: string } | { name: string }[] | null)
    const start = new Date(bk.start_at)
    events.push({
      id: `booking-${bk.id}`,
      date: start.toISOString().slice(0, 10),
      type: 'booking',
      title: service?.name ?? 'Appointment',
      subtitle: contact?.name ?? undefined,
      time: start.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' }),
      href: '/dashboard/bookings',
    })
  }

  for (const item of complianceRes.data ?? []) {
    if (!item.due_date) continue
    events.push({
      id: `compliance-${item.id}`,
      date: item.due_date,
      type: 'compliance_due',
      title: item.title,
      subtitle: item.item_type ?? undefined,
      href: '/dashboard/compliance',
    })
  }

  for (const lic of licenseRes.data ?? []) {
    if (!lic.expiry_date) continue
    const staff = one(lic.staff as { full_name: string } | { full_name: string }[] | null)
    events.push({
      id: `license-${lic.id}`,
      date: lic.expiry_date,
      type: 'license_expiry',
      title: lic.license_type,
      subtitle: staff?.full_name ?? undefined,
      href: '/dashboard/licenses',
    })
  }

  for (const c of contractRes.data ?? []) {
    if (!c.end_date) continue
    const contact = one(c.contact as { name: string } | { name: string }[] | null)
    events.push({
      id: `contract-${c.id}`,
      date: c.end_date,
      type: 'contract_expiry',
      title: c.title,
      subtitle: contact?.name ?? undefined,
      href: '/dashboard/contracts',
    })
  }

  return events
}

/** Groups events by date for fast per-day lookup while rendering the grid. */
export function groupEventsByDate(events: CalendarEvent[]): Map<string, CalendarEvent[]> {
  const map = new Map<string, CalendarEvent[]>()
  for (const e of events) {
    if (!map.has(e.date)) map.set(e.date, [])
    map.get(e.date)!.push(e)
  }
  for (const list of map.values()) {
    list.sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''))
  }
  return map
}
