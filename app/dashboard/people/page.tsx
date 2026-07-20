import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/dashboard/TopBar'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { buildPeopleIntel } from '@/lib/people/signal'
import { getSetupState } from '@/lib/tenant/setup-state'
import { publishSignal } from '@/lib/signals/bus'
import {
  Users, ArrowRight, CalendarCheck, Wallet, HeartPulse, Scale,
  ChevronRight, UserPlus, ClipboardCheck,
} from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function PeopleCockpit() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const tenantId = user.app_metadata?.tenant_id as string

  const [intel, setup] = await Promise.all([buildPeopleIntel(tenantId), getSetupState(tenantId)])
  void publishSignal('people', tenantId, intel.signal)
  const { approvals, wellnessAvg, lowWellness, openIr, activeStaff, pendingLeave, pendingExpenses } = intel
  const totalApprovals = pendingLeave + pendingExpenses

  let lead: { line: string; action: string; href: string }
  if (setup.staff === 0) {
    lead = { line: `Add your team to run payroll, leave and performance reviews in one place — start with your first staff member.`, action: 'Add a staff member', href: '/dashboard/staff?new=1' }
  } else if (openIr > 0) {
    lead = { line: `${openIr} disciplinary record${openIr > 1 ? 's are' : ' is'} awaiting acknowledgement — close the loop to stay CCMA-defensible.`, action: 'Open IR log', href: '/dashboard/ir-log' }
  } else if (totalApprovals > 0) {
    lead = { line: `${totalApprovals} approval${totalApprovals > 1 ? 's are' : ' is'} waiting — ${pendingLeave} leave, ${pendingExpenses} expense. Clearing them keeps the team moving.`, action: 'Clear approvals', href: pendingLeave >= pendingExpenses ? '/dashboard/team' : '/dashboard/expenses' }
  } else if (wellnessAvg !== null && wellnessAvg < 3) {
    lead = { line: `Team wellness is running low (${wellnessAvg}/5). Check in before it shows up as absence or turnover.`, action: 'View the team', href: '/dashboard/team' }
  } else {
    lead = { line: `The team is running well — ${activeStaff} active, nothing pending${wellnessAvg !== null ? `, wellness ${wellnessAvg}/5` : ''}.`, action: 'View the team', href: '/dashboard/team' }
  }

  const dot = intel.signal.health === 'bad' ? '#F87171' : intel.signal.health === 'watch' ? '#FBBF24' : '#34D399'

  const vitals = [
    { label: 'Active team', value: String(activeStaff), sub: 'on the books', icon: Users, color: '#818CF8', href: '/dashboard/staff' },
    { label: 'Pending leave', value: String(pendingLeave), sub: 'to approve', icon: CalendarCheck, color: pendingLeave > 0 ? '#F59E0B' : '#34D399', href: '/dashboard/team' },
    { label: 'Pending expenses', value: String(pendingExpenses), sub: 'to approve', icon: Wallet, color: pendingExpenses > 0 ? '#F59E0B' : '#34D399', href: '/dashboard/expenses' },
    { label: 'Team wellness', value: wellnessAvg !== null ? `${wellnessAvg}/5` : '—', sub: `${lowWellness.length} low`, icon: HeartPulse, color: wellnessAvg !== null && wellnessAvg < 3 ? '#F87171' : '#34D399', href: '/dashboard/team' },
  ]

  return (
    <div>
      <TopBar title="People Cockpit" subtitle="Approvals, wellness and discipline — run the team" />
      <div className="p-6 space-y-6">

        <div className="rounded-2xl px-6 py-5 relative overflow-hidden border on-dark"
          style={{ background: 'linear-gradient(135deg, #101a3e 0%, #172549 100%)', borderColor: 'var(--border)' }}>
          <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 85% 40%, #A78BFA 0%, transparent 60%)' }} />
          <div className="relative">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ background: dot }} />
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>The People Lead</p>
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
          {/* Approvals waiting */}
          <div className="lg:col-span-2 glass rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
              <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Approvals waiting</h3>
              <span className="text-xs" style={{ color: 'var(--text-dim)' }}>{totalApprovals} pending</span>
            </div>
            {approvals.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <ClipboardCheck className="w-8 h-8 mx-auto mb-2" style={{ color: '#34D399' }} />
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Nothing to approve — you&apos;re clear.</p>
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {approvals.map((a, i) => (
                  <Link key={i} href={a.kind === 'leave' ? '/dashboard/team' : '/dashboard/expenses'} className="flex items-center gap-3 px-5 py-3 hover:bg-[var(--surface-hover)] transition-colors">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: a.kind === 'leave' ? 'rgba(99,102,241,0.15)' : 'rgba(245,158,11,0.15)' }}>
                      {a.kind === 'leave' ? <CalendarCheck className="w-4 h-4" style={{ color: 'var(--indigo-light)' }} /> : <Wallet className="w-4 h-4" style={{ color: '#F59E0B' }} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate" style={{ color: 'var(--text-secondary)' }}>{a.who}</p>
                      <p className="text-xs" style={{ color: 'var(--text-dim)' }}>{a.detail}</p>
                    </div>
                    <span className="text-xs capitalize px-2 py-0.5 rounded-full" style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>{a.kind}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Wellness + arsenal */}
          <div className="space-y-4">
            <div className="glass rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] uppercase tracking-wider font-semibold flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}><HeartPulse className="w-3 h-3" /> Check in with</p>
                <Link href="/dashboard/team" className="text-xs font-medium" style={{ color: 'var(--indigo-light)' }}>Team →</Link>
              </div>
              {lowWellness.length === 0 ? (
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{wellnessAvg !== null ? 'Wellness is healthy across the team.' : 'No wellness data yet.'}</p>
              ) : (
                <div className="space-y-2">
                  {lowWellness.map((w, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-sm truncate pr-2" style={{ color: 'var(--text-secondary)' }}>{w.name}</span>
                      <span className="text-xs font-semibold tabular-nums" style={{ color: '#F87171' }}>{w.score.toFixed(1)}/5</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="glass rounded-2xl p-5">
              <p className="text-[10px] uppercase tracking-wider mb-3 font-semibold" style={{ color: 'var(--text-muted)' }}>Arsenal</p>
              <div className="space-y-2">
                <ArsenalLink href="/dashboard/staff" icon={<UserPlus className="w-4 h-4" />} label="Add a staff member" />
                <ArsenalLink href="/dashboard/payroll" icon={<Wallet className="w-4 h-4" />} label="Run payroll" />
                <ArsenalLink href="/dashboard/ir-log" icon={<Scale className="w-4 h-4" />} label="Log an incident" />
                <ArsenalLink href="/dashboard/handbook" icon={<ClipboardCheck className="w-4 h-4" />} label="Handbook & SOPs" />
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
