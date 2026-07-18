import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { TopBar } from '@/components/dashboard/TopBar'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatZAR } from '@/lib/format'
import { publishSignal, financeMode } from '@/lib/signals/bus'
import { getDailyBrief } from '@/lib/signals/brief'
import { BriefCard } from './BriefCard'
import {
  ArrowRight, AlertTriangle, CheckCircle2, Sparkles, Wallet, Users, Package,
  MessageSquare, ClipboardList, CalendarClock, PenLine, Target, ShieldCheck,
} from 'lucide-react'

export const dynamic = 'force-dynamic'

// ── helpers ───────────────────────────────────────────────────────────────
function daysUntil(d: string | null): number | null {
  if (!d) return null
  const ms = new Date(d).getTime() - Date.now()
  return Math.ceil(ms / 86400000)
}
const isTodayISO = (iso: string, todayISO: string) => (iso ?? '').slice(0, 10) === todayISO

export default async function CommandCenter() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const tenantId = user.app_metadata?.tenant_id as string
  const now = new Date()
  const todayISO = now.toISOString().slice(0, 10)
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const days30Ago = new Date(Date.now() - 30 * 86400000).toISOString()
  const days1Ago = new Date(Date.now() - 24 * 3600000).toISOString()

  const [
    invRes, expRes, prodRes, staffRes, leaveRes, contractRes, bookingRes,
    taskRes, convRes, goalRes, complianceRes, auditRes,
  ] = await Promise.all([
    supabaseAdmin.from('invoices').select('amount, amount_paid, status, days_overdue, due_date, contact_name, created_at, recovery_status').eq('tenant_id', tenantId).neq('status', 'paid'),
    supabaseAdmin.from('expenses').select('amount, status, paid_at, created_at').eq('tenant_id', tenantId),
    supabaseAdmin.from('products').select('name, current_stock, reorder_level, cost_price').eq('tenant_id', tenantId),
    supabaseAdmin.from('staff').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('active', true),
    supabaseAdmin.from('leave_requests').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('status', 'pending'),
    supabaseAdmin.from('contracts').select('status, end_date').eq('tenant_id', tenantId),
    supabaseAdmin.from('bookings').select('status, start_at').eq('tenant_id', tenantId).gte('start_at', todayISO),
    supabaseAdmin.from('tasks').select('status, due_date, priority').eq('tenant_id', tenantId).not('status', 'in', '("done","completed","cancelled")'),
    supabaseAdmin.from('conversations').select('status, sentiment').eq('tenant_id', tenantId).eq('status', 'open'),
    supabaseAdmin.from('goals').select('title, progress_pct, status, quarter').eq('tenant_id', tenantId).eq('status', 'active').order('created_at', { ascending: false }).limit(4),
    supabaseAdmin.from('compliance_items').select('title, due_date, status, penalty_description').eq('tenant_id', tenantId).neq('status', 'completed'),
    supabaseAdmin.from('audit_log').select('action, resource_type, created_at').eq('tenant_id', tenantId).gte('created_at', days1Ago).order('created_at', { ascending: false }).limit(200),
  ])

  const invoices = invRes.data ?? []
  const expenses = expRes.data ?? []
  const products = prodRes.data ?? []
  const contracts = contractRes.data ?? []
  const bookings = bookingRes.data ?? []
  const tasks = taskRes.data ?? []
  const conversations = convRes.data ?? []
  const goals = goalRes.data ?? []
  const compliance = complianceRes.data ?? []

  // ── MONEY (cash conversion cycle) ─────────────────────────────────────────
  const outstanding = (i: { amount: number; amount_paid: number }) => Math.max(0, Number(i.amount || 0) - Number(i.amount_paid || 0))
  const arTotal = invoices.reduce((s, i) => s + outstanding(i), 0)
  const arOverdue = invoices.filter(i => (i.days_overdue || 0) > 0).reduce((s, i) => s + outstanding(i), 0)
  const arStuck = invoices.filter(i => (i.days_overdue || 0) > 60).reduce((s, i) => s + outstanding(i), 0)
  const recoveryReview = invoices.filter(i => i.recovery_status === 'awaiting_owner_review').length
  const apTotal = expenses.filter(e => e.paid_at == null && e.status !== 'rejected').reduce((s, e) => s + Number(e.amount || 0), 0)
  const burn30 = expenses.filter(e => e.created_at >= days30Ago).reduce((s, e) => s + Number(e.amount || 0), 0)
  const netPosition = arTotal - apTotal
  const runwayMonths = burn30 > 0 ? netPosition / burn30 : null
  const invoicedThisMonth = invoices.filter(i => i.created_at >= monthStart).reduce((s, i) => s + Number(i.amount || 0), 0)

  // ── OPERATIONS ────────────────────────────────────────────────────────────
  const lowStock = products.filter(p => Number(p.current_stock) <= Number(p.reorder_level))
  const openTasks = tasks.length
  const overdueTasks = tasks.filter(t => t.due_date && new Date(t.due_date) < now).length
  const bookingsToday = bookings.filter(b => isTodayISO(b.start_at, todayISO)).length
  const pendingBookings = bookings.filter(b => b.status === 'pending').length

  // ── CUSTOMERS ─────────────────────────────────────────────────────────────
  const openConvos = conversations.length
  const needAttention = conversations.filter(c => c.sentiment === 'negative' || c.sentiment === 'urgent').length

  // ── PEOPLE ────────────────────────────────────────────────────────────────
  const staffCount = staffRes.count || 0
  const pendingLeave = leaveRes.count || 0
  const pendingExpenses = expenses.filter(e => e.status === 'pending').length

  // ── GOVERNANCE ────────────────────────────────────────────────────────────
  const contractsAwaiting = contracts.filter(c => c.status === 'sent').length
  const contractsExpiring = contracts.filter(c => { const d = daysUntil(c.end_date); return d !== null && d >= 0 && d <= 30 }).length
  const complianceDue = compliance.filter(c => { const d = daysUntil(c.due_date); return d !== null && d <= 14 })

  // ── PUBLISH SIGNALS to the nervous system (Law 2: computed once, read everywhere)
  const arOverdueSig = invoices.filter(i => (i.days_overdue || 0) > 0).reduce((s, i) => s + outstanding(i), 0)
  const mode = financeMode({ netPosition, runwayMonths, arStuck })
  const brief = await getDailyBrief(tenantId)
  void publishSignal('money', tenantId, {
    mode, arTotal, arOverdue: arOverdueSig, arStuck, apTotal, netPosition, runwayMonths, recoveryReview,
    health: netPosition < 0 || arStuck > 0 ? 'bad' : arOverdueSig > 0 ? 'watch' : 'good',
  })
  void publishSignal('sales', tenantId, {
    openConversations: conversations.length, needAttention,
    pipelineValue: arTotal, health: needAttention > 0 ? 'bad' : 'good',
  })
  void publishSignal('ops', tenantId, {
    lowStock: lowStock.length, stockoutRisk: lowStock.slice(0, 5).map(p => p.name),
    bookingsToday, pendingBookings, overdueTasks, health: lowStock.length > 0 || overdueTasks > 0 ? 'watch' : 'good',
  })
  void publishSignal('people', tenantId, {
    activeStaff: staffCount, pendingLeave, pendingExpenses, wellnessAvg: null,
    health: pendingLeave > 0 || pendingExpenses > 0 ? 'watch' : 'good',
  })
  void publishSignal('governance', tenantId, {
    complianceDue: complianceDue.length, contractsExpiring, contractsAwaiting,
    health: complianceDue.length > 0 ? 'bad' : contractsExpiring > 0 ? 'watch' : 'good',
  })

  // ── NEEDS YOU NOW (the decision queue — OODA "act") ───────────────────────
  const decisions = [
    { n: pendingExpenses,    label: 'expense claim',       href: '/dashboard/expenses',   icon: Wallet,        tone: 'amber' as const },
    { n: pendingLeave,       label: 'leave request',       href: '/dashboard/team',       icon: Users,         tone: 'indigo' as const },
    { n: recoveryReview,     label: 'recovery escalation', href: '/dashboard/invoices',   icon: AlertTriangle, tone: 'red' as const },
    { n: contractsAwaiting,  label: 'contract to send',    href: '/dashboard/contracts',  icon: PenLine,       tone: 'indigo' as const },
    { n: lowStock.length,    label: 'item to reorder',     href: '/dashboard/inventory',  icon: Package,       tone: 'amber' as const },
    { n: pendingBookings,    label: 'booking to confirm',  href: '/dashboard/bookings',   icon: CalendarClock, tone: 'indigo' as const },
    { n: needAttention,      label: 'customer waiting',    href: '/dashboard/inbox',      icon: MessageSquare, tone: 'red' as const },
    { n: overdueTasks,       label: 'overdue task',        href: '/dashboard/tasks',      icon: ClipboardList, tone: 'red' as const },
  ].filter(d => d.n > 0).sort((a, b) => ({ red: 0, amber: 1, indigo: 2 }[a.tone] - { red: 0, amber: 1, indigo: 2 }[b.tone]))
  const decisionCount = decisions.reduce((s, d) => s + d.n, 0)

  // ── THE CONSTRAINT (Theory of Constraints — the one bottleneck) ───────────
  type Constraint = { headline: string; detail: string; action: string; href: string }
  const constraints: (Constraint | null)[] = [
    netPosition < 0
      ? { headline: 'You owe more than you are owed', detail: `${formatZAR(apTotal)} in bills vs ${formatZAR(arTotal)} owed to you (net ${formatZAR(netPosition)}).`, action: 'Chase collections & stage payments', href: '/dashboard/cashflow' }
      : null,
    arStuck > 0
      ? { headline: `${formatZAR(arStuck)} is stuck in collections`, detail: `Invoices past 60 days tie up cash you have already earned.`, action: recoveryReview > 0 ? 'Review the recovery queue' : 'Open the debt register', href: '/dashboard/invoices' }
      : null,
    lowStock.length > 0
      ? { headline: `${lowStock.length} product${lowStock.length > 1 ? 's are' : ' is'} at/below reorder level`, detail: `A stockout stops sales — reorder before you run dry.`, action: 'Review inventory & reorder', href: '/dashboard/inventory' }
      : null,
    complianceDue.length > 0
      ? { headline: `${complianceDue.length} compliance deadline${complianceDue.length > 1 ? 's' : ''} within 2 weeks`, detail: complianceDue[0]?.penalty_description || 'Missing a deadline can carry penalties.', action: 'Open the compliance checklist', href: '/dashboard/settings/compliance' }
      : null,
    needAttention > 0
      ? { headline: `${needAttention} customer${needAttention > 1 ? 's are' : ' is'} unhappy or urgent`, detail: `Negative conversations churn customers fastest — respond first.`, action: 'Open the inbox', href: '/dashboard/inbox' }
      : null,
  ]
  const constraint = constraints.find(Boolean) ?? null

  // ── HANDLED FOR YOU (E-Myth: the system works so you don't) ───────────────
  const ACTION_LABELS: { match: RegExp; label: string }[] = [
    { match: /recovery|reminder/i, label: 'chased payments' },
    { match: /invoice/i, label: 'processed invoices' },
    { match: /document|sop/i, label: 'processed documents' },
    { match: /contact|lead/i, label: 'captured leads' },
    { match: /message|whatsapp|conversation/i, label: 'handled messages' },
    { match: /payroll|payslip/i, label: 'ran payroll tasks' },
    { match: /booking/i, label: 'managed bookings' },
  ]
  const handledCounts = new Map<string, number>()
  for (const a of auditRes.data ?? []) {
    const hit = ACTION_LABELS.find(l => l.match.test(`${a.action} ${a.resource_type}`))
    if (hit) handledCounts.set(hit.label, (handledCounts.get(hit.label) ?? 0) + 1)
  }
  const handled = [...handledCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4)

  // ── VITAL SIGNS (Balanced Scorecard: Money / Customers / Ops / People) ────
  type Sign = { label: string; value: string; status: 'good' | 'watch' | 'bad'; href: string }
  const good = 'good' as const, watch = 'watch' as const, bad = 'bad' as const
  const overduePctOfAr = arTotal > 0 ? arOverdue / arTotal : 0
  const scorecard: { lens: string; icon: typeof Wallet; signs: Sign[] }[] = [
    { lens: 'Money', icon: Wallet, signs: [
      { label: 'Owed to you', value: formatZAR(arTotal), status: overduePctOfAr > 0.3 ? bad : overduePctOfAr > 0.1 ? watch : good, href: '/dashboard/invoices' },
      { label: 'You owe', value: formatZAR(apTotal), status: apTotal > arTotal ? watch : good, href: '/dashboard/expenses' },
      { label: 'Net position', value: formatZAR(netPosition), status: netPosition < 0 ? bad : good, href: '/dashboard/cashflow' },
      { label: 'Invoiced this month', value: formatZAR(invoicedThisMonth), status: good, href: '/dashboard/invoices' },
    ]},
    { lens: 'Customers', icon: MessageSquare, signs: [
      { label: 'Open conversations', value: String(openConvos), status: needAttention > 0 ? bad : good, href: '/dashboard/inbox' },
      { label: 'Need attention', value: String(needAttention), status: needAttention > 0 ? bad : good, href: '/dashboard/inbox' },
    ]},
    { lens: 'Operations', icon: Package, signs: [
      { label: 'Low stock', value: String(lowStock.length), status: lowStock.length > 0 ? bad : good, href: '/dashboard/inventory' },
      { label: 'Open tasks', value: String(openTasks), status: overdueTasks > 0 ? watch : good, href: '/dashboard/tasks' },
      { label: 'Bookings today', value: String(bookingsToday), status: good, href: '/dashboard/bookings' },
    ]},
    { lens: 'People', icon: Users, signs: [
      { label: 'Active team', value: String(staffCount), status: good, href: '/dashboard/team' },
      { label: 'Pending leave', value: String(pendingLeave), status: pendingLeave > 0 ? watch : good, href: '/dashboard/team' },
    ]},
  ]

  const firstName = user.user_metadata?.full_name?.split(' ')[0] || user.email?.split('@')[0] || 'there'
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const dateStr = now.toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long' })
  const state = constraint ? (netPosition < 0 || arStuck > 0 ? 'needs attention' : 'on watch') : 'running smoothly'
  const stateColor = state === 'running smoothly' ? '#34D399' : state === 'on watch' ? '#FBBF24' : '#F87171'

  const toneStyle = {
    red:    { bg: 'rgba(239,68,68,0.12)',  fg: '#F87171' },
    amber:  { bg: 'rgba(245,158,11,0.12)', fg: '#F59E0B' },
    indigo: { bg: 'var(--indigo-muted)',   fg: 'var(--indigo-light)' },
  }
  const signColor = { good: '#34D399', watch: '#F59E0B', bad: '#F87171' }

  return (
    <div className="animate-fade-in">
      <TopBar title="Command Center" subtitle={dateStr} />

      <div className="p-6 space-y-6">

        {/* ── THE PULSE ─────────────────────────────────────────────────── */}
        <div className="rounded-2xl px-6 py-5 relative overflow-hidden border on-dark"
          style={{ background: 'linear-gradient(135deg, #111936 0%, #1a2347 100%)', borderColor: 'var(--border)' }}>
          <div className="absolute inset-0 opacity-20 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse at 85% 40%, #6366F1 0%, transparent 60%)' }} />
          <div className="relative">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ background: stateColor }} />
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{greeting}, {firstName} — your business is <span style={{ color: stateColor, fontWeight: 600 }}>{state}</span></p>
            </div>
            <h2 className="text-xl font-semibold mt-1.5 max-w-3xl" style={{ color: 'var(--text-primary)' }}>
              {constraint ? constraint.headline : decisionCount > 0 ? `${decisionCount} decision${decisionCount > 1 ? 's' : ''} waiting for you` : 'Everything is handled — no decisions pending.'}
            </h2>
            <div className="flex items-center gap-4 mt-2 flex-wrap text-sm" style={{ color: 'var(--text-muted)' }}>
              <span>Net position <strong style={{ color: netPosition < 0 ? '#F87171' : '#34D399' }}>{formatZAR(netPosition)}</strong></span>
              {runwayMonths !== null && <span>· ≈ {Math.max(0, Math.round(runwayMonths))} mo runway at current burn</span>}
              <span>· {formatZAR(arOverdue)} overdue</span>
            </div>
            {constraint && (
              <Link href={constraint.href} className="inline-flex items-center gap-2 mt-3 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:opacity-90"
                style={{ background: 'var(--indigo)', color: '#fff' }}>
                {constraint.action} <ArrowRight className="w-4 h-4" />
              </Link>
            )}
            {mode === 'PROTECT' && (
              <p className="mt-3 text-xs inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg" style={{ background: 'rgba(245,158,11,0.12)', color: '#FBBF24' }}>
                <ShieldCheck className="w-3.5 h-3.5" /> Cash-protect mode — hold discretionary spend until collections recover.
              </p>
            )}
            {brief && <BriefCard text={brief.text} generatedAt={brief.generatedAt} />}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT: decision queue + scorecard + constraint */}
          <div className="lg:col-span-2 space-y-6">

            {/* ── NEEDS YOU NOW ──────────────────────────────────────────── */}
            <div className="glass rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Needs You Now</h3>
                  {decisionCount > 0 && (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(239,68,68,0.15)', color: '#F87171' }}>{decisionCount}</span>
                  )}
                </div>
                <span className="text-xs" style={{ color: 'var(--text-dim)' }}>your decisions, in one place</span>
              </div>
              {decisions.length === 0 ? (
                <div className="px-5 py-10 text-center">
                  <CheckCircle2 className="w-8 h-8 mx-auto mb-2" style={{ color: '#34D399' }} />
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>You&apos;re all caught up.</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Nothing needs a decision right now — AdminOS is handling the rest.</p>
                </div>
              ) : (
                <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                  {decisions.map((d) => {
                    const t = toneStyle[d.tone]
                    return (
                      <Link key={d.label} href={d.href} className="flex items-center gap-3 px-5 py-3 hover:bg-[var(--surface-hover)] transition-colors">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: t.bg }}>
                          <d.icon className="w-4 h-4" style={{ color: t.fg }} />
                        </div>
                        <p className="flex-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                          <strong style={{ color: 'var(--text-primary)' }}>{d.n}</strong> {d.label}{d.n > 1 ? 's' : ''}
                        </p>
                        <ArrowRight className="w-3.5 h-3.5" style={{ color: 'var(--text-dim)' }} />
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>

            {/* ── VITAL SIGNS (weekly scorecard) ─────────────────────────── */}
            <div className="glass rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Vital Signs</h3>
                <Link href="/dashboard/health" className="text-xs font-medium" style={{ color: 'var(--indigo-light)' }}>Full health →</Link>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
                {scorecard.map((group) => (
                  <div key={group.lens}>
                    <div className="flex items-center gap-1.5 mb-2">
                      <group.icon className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
                      <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--text-muted)' }}>{group.lens}</p>
                    </div>
                    <div className="space-y-1.5">
                      {group.signs.map((s) => (
                        <Link key={s.label} href={s.href} className="flex items-center justify-between group">
                          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{s.label}</span>
                          <span className="flex items-center gap-1.5">
                            <span className="text-sm font-semibold tabular-nums group-hover:underline" style={{ color: 'var(--text-primary)' }}>{s.value}</span>
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: signColor[s.status] }} />
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── THE CONSTRAINT ─────────────────────────────────────────── */}
            {constraint && (
              <div className="glass rounded-2xl p-5" style={{ borderLeft: '3px solid #F59E0B' }}>
                <div className="flex items-center gap-2 mb-1">
                  <Target className="w-4 h-4" style={{ color: '#F59E0B' }} />
                  <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: '#F59E0B' }}>This week&apos;s #1 constraint</p>
                </div>
                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{constraint.headline}</p>
                <p className="text-xs mt-0.5 mb-3" style={{ color: 'var(--text-muted)' }}>{constraint.detail}</p>
                <Link href={constraint.href} className="inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: 'var(--indigo-light)' }}>
                  {constraint.action} <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            )}
          </div>

          {/* RIGHT: handled-for-you + rhythm */}
          <div className="space-y-6">

            {/* ── HANDLED FOR YOU ────────────────────────────────────────── */}
            <div className="glass rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4" style={{ color: 'var(--indigo-light)' }} />
                <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--text-muted)' }}>Handled for you · 24h</p>
              </div>
              {handled.length === 0 ? (
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>AdminOS runs your reminders, document processing and lead capture automatically. Actions from the last day will show here.</p>
              ) : (
                <div className="space-y-2.5">
                  {handled.map(([label, n]) => (
                    <div key={label} className="flex items-center gap-2.5">
                      <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ background: 'var(--indigo-muted)' }}>
                        <CheckCircle2 className="w-3.5 h-3.5" style={{ color: 'var(--indigo-light)' }} />
                      </div>
                      <p className="text-sm capitalize" style={{ color: 'var(--text-secondary)' }}>{label}</p>
                      <span className="ml-auto text-xs font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>×{n}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── OPERATING RHYTHM: quarterly goals (Rocks) ──────────────── */}
            <div className="glass rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4" style={{ color: '#A78BFA' }} />
                  <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--text-muted)' }}>Quarterly goals</p>
                </div>
                <Link href="/dashboard/analytics" className="text-xs font-medium" style={{ color: 'var(--indigo-light)' }}>All →</Link>
              </div>
              {goals.length === 0 ? (
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No active goals. Set 1–3 quarterly priorities to give the team a shared focus.</p>
              ) : (
                <div className="space-y-3">
                  {goals.map((g, i) => {
                    const pct = Math.min(g.progress_pct || 0, 100)
                    const c = pct >= 75 ? '#34D399' : pct >= 40 ? '#F59E0B' : 'var(--indigo)'
                    return (
                      <div key={i}>
                        <div className="flex justify-between items-center mb-1">
                          <p className="text-xs truncate pr-3" style={{ color: 'var(--text-secondary)' }}>{g.title}</p>
                          <span className="text-xs font-semibold shrink-0 tabular-nums" style={{ color: 'var(--text-primary)' }}>{Math.round(pct)}%</span>
                        </div>
                        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
                          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: c }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* ── GOVERNANCE watch: contracts + compliance ───────────────── */}
            {(contractsExpiring > 0 || complianceDue.length > 0 || contractsAwaiting > 0) && (
              <div className="glass rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <ShieldCheck className="w-4 h-4" style={{ color: '#38BDF8' }} />
                  <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--text-muted)' }}>On the horizon</p>
                </div>
                <div className="space-y-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {complianceDue.length > 0 && <Link href="/dashboard/settings/compliance" className="flex items-center justify-between hover:underline"><span>Compliance deadlines ≤14d</span><span className="font-semibold" style={{ color: '#F87171' }}>{complianceDue.length}</span></Link>}
                  {contractsExpiring > 0 && <Link href="/dashboard/contracts" className="flex items-center justify-between hover:underline"><span>Contracts expiring ≤30d</span><span className="font-semibold" style={{ color: '#F59E0B' }}>{contractsExpiring}</span></Link>}
                  {contractsAwaiting > 0 && <Link href="/dashboard/contracts" className="flex items-center justify-between hover:underline"><span>Contracts awaiting signature</span><span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{contractsAwaiting}</span></Link>}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
