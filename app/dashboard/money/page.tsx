import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/dashboard/TopBar'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatZAR } from '@/lib/format'
import { buildMoneyIntel } from '@/lib/money/signal'
import { getSetupState } from '@/lib/tenant/setup-state'
import { publishSignal } from '@/lib/signals/bus'
import { SendRemindersButton } from '@/components/dashboard/SendRemindersButton'
import {
  Wallet, ArrowRight, TrendingUp, TrendingDown, Landmark, FileSpreadsheet,
  Receipt, AlertTriangle, ChevronRight, PiggyBank,
} from 'lucide-react'

export const dynamic = 'force-dynamic'

const AGING_COLOR: Record<string, string> = {
  current: '#34D399', d1_30: '#818CF8', d31_60: '#F59E0B', d61_90: '#FB923C', d90_plus: '#F87171',
}

export default async function CashCockpit() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const tenantId = user.app_metadata?.tenant_id as string

  const [intel, setup] = await Promise.all([buildMoneyIntel(tenantId), getSetupState(tenantId)])
  void publishSignal('money', tenantId, intel.signal)
  const { signal: s, aging, overdue } = intel

  // ── The Bookkeeper leads (deterministic, pre-briefed) ──────────────────────
  let lead: { line: string; action: string; href: string; remind?: boolean }
  if (setup.invoices === 0) {
    lead = { line: `Let's get the money moving — raise your first invoice and AdminOS tracks who owes you and chases overdue payers for you.`, action: 'Create your first invoice', href: '/dashboard/invoices?new=1' }
  } else if (s.arStuck > 0) {
    lead = { line: `You're owed ${formatZAR(s.arTotal)}, and ${formatZAR(s.arStuck)} of it is 60+ days overdue — cash you've earned but haven't collected. Chase the oldest first.`, action: 'Review recovery queue', href: '/dashboard/invoices' }
  } else if (s.arOverdue > 0) {
    lead = { line: `You're owed ${formatZAR(s.arTotal)}, with ${formatZAR(s.arOverdue)} overdue. A reminder today is the cheapest way to bring it in.`, action: 'Send reminders', href: '/dashboard/invoices', remind: true }
  } else if (s.apTotal > s.arTotal && s.apTotal > 0) {
    lead = { line: `You owe ${formatZAR(s.apTotal)} but are only owed ${formatZAR(s.arTotal)} — net ${formatZAR(s.netPosition)}. Stage payments and keep invoicing.`, action: 'Review what you owe', href: '/dashboard/expenses' }
  } else {
    lead = { line: `Cash is healthy — net position ${formatZAR(s.netPosition)}${s.runwayMonths !== null ? `, ~${Math.max(0, Math.round(s.runwayMonths))} months runway` : ''}. Keep the invoices going out.`, action: 'Create an invoice', href: '/dashboard/invoices' }
  }

  const agingMax = Math.max(1, ...aging.map(b => b.amount))
  const modeColor = s.mode === 'PROTECT' ? '#F87171' : s.mode === 'STEADY' ? '#FBBF24' : '#34D399'

  const vitals = [
    { label: 'Net position', value: formatZAR(s.netPosition), sub: 'AR − AP', icon: Wallet, color: s.netPosition < 0 ? '#F87171' : '#34D399' },
    { label: 'Owed to you', value: formatZAR(s.arTotal), sub: `${formatZAR(s.arOverdue)} overdue`, icon: TrendingUp, color: '#818CF8', href: '/dashboard/invoices' },
    { label: 'You owe', value: formatZAR(s.apTotal), sub: `${intel.apCount} unpaid`, icon: TrendingDown, color: '#F59E0B', href: '/dashboard/expenses' },
    { label: 'Runway', value: s.runwayMonths !== null ? `${Math.max(0, Math.round(s.runwayMonths))} mo` : '—', sub: `${formatZAR(intel.burn30)}/mo burn`, icon: PiggyBank, color: modeColor, href: '/dashboard/cashflow' },
  ]

  return (
    <div>
      <TopBar title="Cash Cockpit" subtitle="Money in, money out — the whole cash picture" />
      <div className="p-6 space-y-6">

        {/* ── The Bookkeeper leads ─────────────────────────────────────────── */}
        <div className="rounded-2xl px-6 py-5 relative overflow-hidden border on-dark"
          style={{ background: 'linear-gradient(135deg, #101a3e 0%, #16224d 100%)', borderColor: 'var(--border)' }}>
          <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 85% 40%, #6366F1 0%, transparent 60%)' }} />
          <div className="relative">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ background: modeColor }} />
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>The Bookkeeper · cash mode <span style={{ color: modeColor, fontWeight: 600 }}>{s.mode}</span></p>
            </div>
            <p className="text-lg font-semibold mt-1.5 max-w-3xl" style={{ color: 'var(--text-primary)' }}>{lead.line}</p>
            {lead.remind ? (
              <SendRemindersButton label={lead.action} />
            ) : (
              <Link href={lead.href} className="inline-flex items-center gap-2 mt-3 px-4 py-2 rounded-xl text-sm font-semibold hover:opacity-90"
                style={{ background: 'var(--indigo)', color: '#fff' }}>{lead.action} <ArrowRight className="w-4 h-4" /></Link>
            )}
          </div>
        </div>

        {/* ── Vital signs ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {vitals.map(v => {
            const inner = (
              <>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${v.color}20` }}>
                    <v.icon className="w-4 h-4" style={{ color: v.color }} />
                  </div>
                  <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{v.label}</span>
                </div>
                <p className="text-2xl font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>{v.value}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-dim)' }}>{v.sub}</p>
              </>
            )
            return v.href
              ? <Link key={v.label} href={v.href} className="glass rounded-2xl p-5 block hover:bg-[var(--surface-hover)] transition-colors">{inner}</Link>
              : <div key={v.label} className="glass rounded-2xl p-5">{inner}</div>
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ── AR aging pipeline (the collections funnel) ─────────────────── */}
          <div className="lg:col-span-2 glass rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Collections pipeline · aging</h3>
              <span className="text-xs" style={{ color: 'var(--text-dim)' }}>{formatZAR(s.arTotal)} across {intel.arCount}</span>
            </div>
            <div className="space-y-3">
              {aging.map(b => (
                <div key={b.key}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{b.label}</span>
                    <span className="text-xs font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                      {formatZAR(b.amount)} <span style={{ color: 'var(--text-dim)' }}>· {b.count}</span>
                    </span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${Math.max(b.amount > 0 ? 4 : 0, (b.amount / agingMax) * 100)}%`, background: AGING_COLOR[b.key] }} />
                  </div>
                </div>
              ))}
            </div>
            {s.arStuck > 0 && (
              <div className="mt-4 flex items-center gap-2 p-3 rounded-lg text-xs" style={{ background: 'rgba(239,68,68,0.10)', color: '#F87171' }}>
                <AlertTriangle className="w-4 h-4 shrink-0" />
                {formatZAR(s.arStuck)} is past 60 days — the older it gets, the less likely it is to be paid. Prioritise these.
              </div>
            )}
          </div>

          {/* ── Arsenal ──────────────────────────────────────────────────────── */}
          <div className="space-y-4">
            <div className="glass rounded-2xl p-5">
              <p className="text-[10px] uppercase tracking-wider mb-3 font-semibold" style={{ color: 'var(--text-muted)' }}>Arsenal</p>
              <div className="space-y-2">
                <ArsenalLink href="/dashboard/invoices" icon={<Receipt className="w-4 h-4" />} label="New invoice" />
                <ArsenalLink href="/api/money/export?type=vat201" icon={<Landmark className="w-4 h-4" />} label="Export VAT201 working paper" download />
                <ArsenalLink href="/api/money/export?type=journal" icon={<FileSpreadsheet className="w-4 h-4" />} label="Export journal (Xero/Sage)" download />
                <ArsenalLink href="/dashboard/cashflow" icon={<TrendingUp className="w-4 h-4" />} label="90-day cashflow forecast" />
              </div>
            </div>

            {/* Top overdue */}
            <div className="glass rounded-2xl p-5">
              <p className="text-[10px] uppercase tracking-wider mb-3 font-semibold" style={{ color: 'var(--text-muted)' }}>Chase first</p>
              {overdue.length === 0 ? (
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Nothing overdue — collections are clean.</p>
              ) : (
                <div className="space-y-2">
                  {overdue.map(o => (
                    <Link key={o.id} href="/dashboard/invoices" className="flex items-center gap-2 group">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate" style={{ color: 'var(--text-secondary)' }}>{o.contact}</p>
                        <p className="text-xs" style={{ color: '#F87171' }}>{o.daysOverdue} days overdue</p>
                      </div>
                      <span className="text-sm font-semibold tabular-nums group-hover:underline" style={{ color: 'var(--text-primary)' }}>{formatZAR(o.outstanding)}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ArsenalLink({ href, icon, label, download }: { href: string; icon: React.ReactNode; label: string; download?: boolean }) {
  const cls = 'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors hover:bg-[var(--surface-hover)]'
  const style = { color: 'var(--text-secondary)' }
  const inner = <>
    <span style={{ color: 'var(--indigo-light)' }}>{icon}</span>
    <span className="flex-1">{label}</span>
    <ChevronRight className="w-3.5 h-3.5" style={{ color: 'var(--text-dim)' }} />
  </>
  return download
    ? <a href={href} className={cls} style={style}>{inner}</a>
    : <Link href={href} className={cls} style={style}>{inner}</Link>
}
