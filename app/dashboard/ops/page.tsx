import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/dashboard/TopBar'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatZAR } from '@/lib/format'
import { buildOpsIntel } from '@/lib/ops/signal'
import { getSetupState } from '@/lib/tenant/setup-state'
import { publishSignal } from '@/lib/signals/bus'
import {
  Package, ArrowRight, CalendarClock, ClipboardList, Boxes,
  AlertTriangle, ChevronRight, Plus, CalendarDays,
} from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function OpsCockpit() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const tenantId = user.app_metadata?.tenant_id as string

  const [intel, setup] = await Promise.all([buildOpsIntel(tenantId), getSetupState(tenantId)])
  void publishSignal('ops', tenantId, intel.signal)
  const { lowStockItems, bookingsToday, overdueTasks, openTasks, pendingBookings } = intel

  // ── The Operator leads ─────────────────────────────────────────────────────
  let lead: { line: string; action: string; href: string }
  if (setup.products === 0) {
    lead = { line: `Set up what you sell — add your first product or service, and AdminOS tracks stock, bookings and jobs from here.`, action: 'Add a product', href: '/dashboard/inventory?new=1' }
  } else if (lowStockItems.length > 0) {
    lead = { line: `${lowStockItems.length} product${lowStockItems.length > 1 ? 's are' : ' is'} at or below reorder level — a stockout stops sales. Reorder before you run dry.`, action: 'Review inventory', href: '/dashboard/inventory' }
  } else if (pendingBookings > 0) {
    lead = { line: `${pendingBookings} booking${pendingBookings > 1 ? 's are' : ' is'} awaiting confirmation — confirm today to lock the schedule and cut no-shows.`, action: 'Open bookings', href: '/dashboard/bookings' }
  } else if (overdueTasks > 0) {
    lead = { line: `${overdueTasks} task${overdueTasks > 1 ? 's are' : ' is'} overdue — work is slipping. Clear the oldest to keep jobs on time.`, action: 'Open tasks', href: '/dashboard/tasks' }
  } else {
    lead = { line: `Operations are smooth — ${bookingsToday.length} booking${bookingsToday.length === 1 ? '' : 's'} today, stock healthy, nothing overdue.`, action: 'View the schedule', href: '/dashboard/bookings' }
  }

  const health = intel.signal.health
  const dot = health === 'bad' ? '#F87171' : health === 'watch' ? '#FBBF24' : '#34D399'

  const vitals = [
    { label: 'Low stock', value: String(lowStockItems.length), sub: `${intel.totalSkus} SKUs`, icon: Package, color: lowStockItems.length > 0 ? '#F87171' : '#34D399', href: '/dashboard/inventory' },
    { label: 'Stock value', value: formatZAR(intel.stockValueCost, { cents: true }), sub: 'at cost', icon: Boxes, color: '#818CF8', href: '/dashboard/inventory' },
    { label: 'Bookings today', value: String(bookingsToday.length), sub: `${intel.upcoming7} next 7 days`, icon: CalendarClock, color: '#38BDF8', href: '/dashboard/bookings' },
    { label: 'Open tasks', value: String(openTasks), sub: `${overdueTasks} overdue`, icon: ClipboardList, color: overdueTasks > 0 ? '#F59E0B' : '#34D399', href: '/dashboard/tasks' },
  ]

  const statusColor: Record<string, string> = { confirmed: '#34D399', pending: '#FBBF24', cancelled: '#F87171', completed: '#818CF8' }

  return (
    <div>
      <TopBar title="Ops Cockpit" subtitle="Stock, schedule and work — the day at a glance" />
      <div className="p-6 space-y-6">

        {/* ── The Operator leads ───────────────────────────────────────────── */}
        <div className="rounded-2xl px-6 py-5 relative overflow-hidden border on-dark"
          style={{ background: 'linear-gradient(135deg, #0f1f3d 0%, #14284d 100%)', borderColor: 'var(--border)' }}>
          <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 85% 40%, #38BDF8 0%, transparent 60%)' }} />
          <div className="relative">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ background: dot }} />
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>The Operator</p>
            </div>
            <p className="text-lg font-semibold mt-1.5 max-w-3xl" style={{ color: 'var(--text-primary)' }}>{lead.line}</p>
            <Link href={lead.href} className="inline-flex items-center gap-2 mt-3 px-4 py-2 rounded-xl text-sm font-semibold hover:opacity-90"
              style={{ background: 'var(--indigo)', color: '#fff' }}>{lead.action} <ArrowRight className="w-4 h-4" /></Link>
          </div>
        </div>

        {/* ── Vital signs ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {vitals.map(v => (
            <Link key={v.label} href={v.href} className="glass rounded-2xl p-5 block hover:bg-[var(--surface-hover)] transition-colors">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${v.color}20` }}>
                  <v.icon className="w-4 h-4" style={{ color: v.color }} />
                </div>
                <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{v.label}</span>
              </div>
              <p className="text-2xl font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>{v.value}</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-dim)' }}>{v.sub}</p>
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ── Today's schedule ──────────────────────────────────────────── */}
          <div className="lg:col-span-2 glass rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
              <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Today&apos;s schedule</h3>
              <Link href="/dashboard/bookings" className="text-xs font-medium" style={{ color: 'var(--indigo-light)' }}>All bookings →</Link>
            </div>
            {bookingsToday.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <CalendarDays className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--text-dim)' }} />
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No bookings today.</p>
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {bookingsToday.map(b => (
                  <div key={b.id} className="flex items-center gap-3 px-5 py-3">
                    <span className="text-sm font-semibold tabular-nums w-14 shrink-0" style={{ color: 'var(--text-primary)' }}>{b.when}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate" style={{ color: 'var(--text-secondary)' }}>{b.who}</p>
                      <p className="text-xs" style={{ color: 'var(--text-dim)' }}>{b.service}</p>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full capitalize" style={{ background: `${statusColor[b.status] ?? '#94A3B8'}20`, color: statusColor[b.status] ?? '#94A3B8' }}>{b.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Stock readiness + arsenal ─────────────────────────────────── */}
          <div className="space-y-4">
            <div className="glass rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--text-muted)' }}>Reorder now</p>
                <Link href="/dashboard/inventory" className="text-xs font-medium" style={{ color: 'var(--indigo-light)' }}>Inventory →</Link>
              </div>
              {lowStockItems.length === 0 ? (
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Stock is healthy — nothing at reorder level.</p>
              ) : (
                <div className="space-y-2">
                  {lowStockItems.slice(0, 6).map(i => (
                    <div key={i.name} className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate" style={{ color: 'var(--text-secondary)' }}>{i.name}</p>
                        <p className="text-xs" style={{ color: '#F87171' }}>{i.onHand} on hand · reorder at {i.reorderAt}</p>
                      </div>
                      <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: '#F87171' }} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="glass rounded-2xl p-5">
              <p className="text-[10px] uppercase tracking-wider mb-3 font-semibold" style={{ color: 'var(--text-muted)' }}>Arsenal</p>
              <div className="space-y-2">
                <ArsenalLink href="/dashboard/inventory" icon={<Plus className="w-4 h-4" />} label="Add / restock product" />
                <ArsenalLink href="/dashboard/bookings" icon={<CalendarClock className="w-4 h-4" />} label="New booking" />
                <ArsenalLink href="/dashboard/tasks" icon={<ClipboardList className="w-4 h-4" />} label="Add task" />
                <ArsenalLink href="/dashboard/calendar" icon={<CalendarDays className="w-4 h-4" />} label="Open calendar" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ArsenalLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link href={href} className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors hover:bg-[var(--surface-hover)]" style={{ color: 'var(--text-secondary)' }}>
      <span style={{ color: 'var(--indigo-light)' }}>{icon}</span>
      <span className="flex-1">{label}</span>
      <ChevronRight className="w-3.5 h-3.5" style={{ color: 'var(--text-dim)' }} />
    </Link>
  )
}
