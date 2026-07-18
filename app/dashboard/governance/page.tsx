import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/dashboard/TopBar'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatZAR } from '@/lib/format'
import { buildGovernanceIntel } from '@/lib/governance/signal'
import { publishSignal } from '@/lib/signals/bus'
import {
  ShieldCheck, ArrowRight, HeartPulse, Gauge, FileSignature,
  ChevronRight, Landmark, AlertTriangle, CalendarClock,
} from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function GovernanceCockpit() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const tenantId = user.app_metadata?.tenant_id as string

  const intel = await buildGovernanceIntel(tenantId)
  void publishSignal('governance', tenantId, intel.signal)
  const { deadlines, contractsExpiring, contractsAwaiting, healthScore, valuation } = intel
  const complianceDue = intel.signal.complianceDue

  let lead: { line: string; action: string; href: string }
  if (complianceDue > 0) {
    const soonest = deadlines[0]
    lead = { line: `${complianceDue} compliance deadline${complianceDue > 1 ? 's are' : ' is'} within two weeks${soonest ? ` — ${soonest.title} is next` : ''}. Missing these carries penalties.`, action: 'Open compliance', href: '/dashboard/settings/compliance' }
  } else if (contractsExpiring > 0) {
    lead = { line: `${contractsExpiring} contract${contractsExpiring > 1 ? 's expire' : ' expires'} within 30 days — renew or renegotiate before they lapse.`, action: 'Review contracts', href: '/dashboard/contracts' }
  } else if (healthScore !== null && healthScore < 60) {
    lead = { line: `Business health is ${healthScore}/100 — below the healthy line. Fix the weakest dimension to lift it.`, action: 'See health', href: '/dashboard/health' }
  } else {
    lead = { line: `Governance is in good shape${healthScore !== null ? ` — health ${healthScore}/100` : ''}${valuation !== null ? `, valued around ${formatZAR(valuation)}` : ''}. Nothing urgent.`, action: 'View health', href: '/dashboard/health' }
  }

  const dot = intel.signal.health === 'bad' ? '#F87171' : intel.signal.health === 'watch' ? '#FBBF24' : '#34D399'
  const healthColor = healthScore === null ? '#818CF8' : healthScore >= 75 ? '#34D399' : healthScore >= 60 ? '#F59E0B' : '#F87171'

  const vitals = [
    { label: 'Business health', value: healthScore !== null ? `${healthScore}/100` : '—', sub: 'across 6 dimensions', icon: HeartPulse, color: healthColor, href: '/dashboard/health' },
    { label: 'Compliance due', value: String(complianceDue), sub: '≤14 days', icon: ShieldCheck, color: complianceDue > 0 ? '#F87171' : '#34D399', href: '/dashboard/settings/compliance' },
    { label: 'Contracts', value: String(contractsExpiring + contractsAwaiting), sub: `${contractsExpiring} expiring · ${contractsAwaiting} to sign`, icon: FileSignature, color: contractsExpiring > 0 ? '#F59E0B' : '#818CF8', href: '/dashboard/contracts' },
    { label: 'Valuation', value: valuation !== null ? formatZAR(valuation) : '—', sub: 'estimated worth', icon: Gauge, color: '#A78BFA', href: '/dashboard/valuation' },
  ]

  const dlColor = (d: number | null) => d === null ? '#94A3B8' : d <= 3 ? '#F87171' : d <= 14 ? '#F59E0B' : '#818CF8'

  return (
    <div>
      <TopBar title="Governance Cockpit" subtitle="Deadlines, contracts, health and worth — stay safe & investor-ready" />
      <div className="p-6 space-y-6">

        <div className="rounded-2xl px-6 py-5 relative overflow-hidden border on-dark"
          style={{ background: 'linear-gradient(135deg, #101a3e 0%, #16224a 100%)', borderColor: 'var(--border)' }}>
          <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 85% 40%, #38BDF8 0%, transparent 60%)' }} />
          <div className="relative">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ background: dot }} />
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>The Advisor</p>
            </div>
            <p className="text-lg font-semibold mt-1.5 max-w-3xl" style={{ color: 'var(--text-primary)' }}>{lead.line}</p>
            <Link href={lead.href} className="inline-flex items-center gap-2 mt-3 px-4 py-2 rounded-xl text-sm font-semibold hover:opacity-90"
              style={{ background: 'var(--indigo)', color: '#fff' }}>{lead.action} <ArrowRight className="w-4 h-4" /></Link>
          </div>
        </div>

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
          {/* Deadlines */}
          <div className="lg:col-span-2 glass rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
              <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>On the horizon · deadlines</h3>
              <Link href="/dashboard/settings/compliance" className="text-xs font-medium" style={{ color: 'var(--indigo-light)' }}>Compliance →</Link>
            </div>
            {deadlines.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <ShieldCheck className="w-8 h-8 mx-auto mb-2" style={{ color: '#34D399' }} />
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No deadlines in the next 60 days.</p>
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {deadlines.map((d, i) => (
                  <div key={i} className="flex items-center gap-3 px-5 py-3">
                    <CalendarClock className="w-4 h-4 shrink-0" style={{ color: dlColor(d.daysLeft) }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate" style={{ color: 'var(--text-secondary)' }}>{d.title}</p>
                      {d.penalty && <p className="text-xs truncate" style={{ color: 'var(--text-dim)' }}>{d.penalty}</p>}
                    </div>
                    <span className="text-xs font-semibold shrink-0" style={{ color: dlColor(d.daysLeft) }}>
                      {d.daysLeft === null ? '—' : d.daysLeft < 0 ? `${-d.daysLeft}d overdue` : d.daysLeft === 0 ? 'today' : `${d.daysLeft}d`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Arsenal */}
          <div className="glass rounded-2xl p-5 self-start">
            <p className="text-[10px] uppercase tracking-wider mb-3 font-semibold" style={{ color: 'var(--text-muted)' }}>Arsenal</p>
            <div className="space-y-2">
              <ArsenalLink href="/dashboard/settings/compliance" icon={<ShieldCheck className="w-4 h-4" />} label="Compliance checklist" />
              <ArsenalLink href="/dashboard/contracts" icon={<FileSignature className="w-4 h-4" />} label="New contract" />
              <ArsenalLink href="/dashboard/board-pack" icon={<Landmark className="w-4 h-4" />} label="Generate board pack" />
              <ArsenalLink href="/dashboard/valuation" icon={<Gauge className="w-4 h-4" />} label="Business valuation" />
            </div>
            {healthScore !== null && healthScore < 60 && (
              <div className="mt-3 flex items-center gap-2 p-2.5 rounded-lg text-xs" style={{ background: 'rgba(239,68,68,0.10)', color: '#F87171' }}>
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> Health below 60 — investors and lenders look here first.
              </div>
            )}
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
