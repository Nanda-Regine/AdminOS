import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/dashboard/TopBar'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatZAR } from '@/lib/format'
import { buildSalesIntel } from '@/lib/sales/signal'
import { publishSignal } from '@/lib/signals/bus'
import {
  MessageSquare, ArrowRight, Users, TrendingUp, Snowflake,
  ChevronRight, Radio, Zap, UserPlus, AlertTriangle,
} from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function SalesCockpit() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const tenantId = user.app_metadata?.tenant_id as string

  const intel = await buildSalesIntel(tenantId)
  void publishSignal('sales', tenantId, intel.signal)
  const { attentionList, staleContacts, needAttention, openConversations, totalContacts } = intel

  // ── The Closer leads ───────────────────────────────────────────────────────
  let lead: { line: string; action: string; href: string }
  if (needAttention > 0) {
    lead = { line: `${needAttention} customer${needAttention > 1 ? 's are' : ' is'} unhappy or urgent right now — respond first. Churn happens fastest here, and a fast reply saves the relationship.`, action: 'Open the inbox', href: '/dashboard/inbox' }
  } else if (staleContacts.length > 0) {
    lead = { line: `${staleContacts.length} good contact${staleContacts.length > 1 ? 's have' : ' has'} gone quiet for 30+ days — leads go cold fast. A message or a sequence brings them back.`, action: 'Re-engage them', href: '/dashboard/reach' }
  } else {
    lead = { line: `Pipeline is warm — ${openConversations} open conversation${openConversations === 1 ? '' : 's'} across ${totalContacts} contacts. Keep them moving.`, action: 'Open the inbox', href: '/dashboard/inbox' }
  }

  const dot = intel.signal.health === 'bad' ? '#F87171' : intel.signal.health === 'watch' ? '#FBBF24' : '#34D399'

  const vitals = [
    { label: 'Open conversations', value: String(openConversations), sub: 'active threads', icon: MessageSquare, color: '#818CF8', href: '/dashboard/inbox' },
    { label: 'Need attention', value: String(needAttention), sub: 'unhappy / urgent', icon: AlertTriangle, color: needAttention > 0 ? '#F87171' : '#34D399', href: '/dashboard/inbox' },
    { label: 'Pipeline', value: formatZAR(intel.pipelineValue), sub: 'won, awaiting pay', icon: TrendingUp, color: '#34D399', href: '/dashboard/invoices' },
    { label: 'Contacts', value: String(totalContacts), sub: `${formatZAR(intel.lifetimeRevenue)} lifetime`, icon: Users, color: '#38BDF8', href: '/dashboard/contacts' },
  ]

  const sentColor: Record<string, string> = { negative: '#F87171', urgent: '#F87171', neutral: '#94A3B8', positive: '#34D399' }

  return (
    <div>
      <TopBar title="Sales Cockpit" subtitle="The pipeline, unhappy customers, and leads going cold" />
      <div className="p-6 space-y-6">

        <div className="rounded-2xl px-6 py-5 relative overflow-hidden border on-dark"
          style={{ background: 'linear-gradient(135deg, #101a3e 0%, #182a4f 100%)', borderColor: 'var(--border)' }}>
          <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 85% 40%, #34D399 0%, transparent 60%)' }} />
          <div className="relative">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ background: dot }} />
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>The Closer</p>
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
          {/* Needs attention */}
          <div className="lg:col-span-2 glass rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
              <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Respond first</h3>
              <Link href="/dashboard/inbox" className="text-xs font-medium" style={{ color: 'var(--indigo-light)' }}>Inbox →</Link>
            </div>
            {attentionList.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <MessageSquare className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--text-dim)' }} />
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No unhappy or urgent conversations. Customers are content.</p>
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {attentionList.map((c, i) => (
                  <Link key={i} href="/dashboard/inbox" className="flex items-center gap-3 px-5 py-3 hover:bg-[var(--surface-hover)] transition-colors">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold shrink-0" style={{ background: 'rgba(239,68,68,0.15)', color: '#F87171' }}>
                      {(c.name || '?')[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate" style={{ color: 'var(--text-secondary)' }}>{c.name}</p>
                      <p className="text-xs" style={{ color: 'var(--text-dim)' }}>{c.when}</p>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full capitalize" style={{ background: `${sentColor[c.sentiment] ?? '#F87171'}20`, color: sentColor[c.sentiment] ?? '#F87171' }}>{c.sentiment}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Going cold + arsenal */}
          <div className="space-y-4">
            <div className="glass rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] uppercase tracking-wider font-semibold flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                  <Snowflake className="w-3 h-3" /> Going cold
                </p>
                <Link href="/dashboard/contacts" className="text-xs font-medium" style={{ color: 'var(--indigo-light)' }}>Contacts →</Link>
              </div>
              {staleContacts.length === 0 ? (
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Everyone&apos;s been contacted recently.</p>
              ) : (
                <div className="space-y-2">
                  {staleContacts.map((c, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate" style={{ color: 'var(--text-secondary)' }}>{c.name}</p>
                        <p className="text-xs" style={{ color: 'var(--text-dim)' }}>{c.lastContacted ? `last ${new Date(c.lastContacted).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}` : 'never contacted'}</p>
                      </div>
                      {c.value > 0 && <span className="text-xs font-semibold tabular-nums" style={{ color: 'var(--text-dim)' }}>{formatZAR(c.value)}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="glass rounded-2xl p-5">
              <p className="text-[10px] uppercase tracking-wider mb-3 font-semibold" style={{ color: 'var(--text-muted)' }}>Arsenal</p>
              <div className="space-y-2">
                <ArsenalLink href="/dashboard/contacts" icon={<UserPlus className="w-4 h-4" />} label="Add contact" />
                <ArsenalLink href="/dashboard/reach" icon={<Radio className="w-4 h-4" />} label="Send a broadcast" />
                <ArsenalLink href="/dashboard/sequences" icon={<Zap className="w-4 h-4" />} label="Start a sequence" />
                <ArsenalLink href="/dashboard/inbox" icon={<MessageSquare className="w-4 h-4" />} label="Open the inbox" />
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
