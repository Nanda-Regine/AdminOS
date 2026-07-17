import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { TopBar } from '@/components/dashboard/TopBar'
import { StatCard } from '@/components/dashboard/StatCard'
import { LiveActivityFeed } from '@/components/dashboard/LiveActivityFeed'
import { LiveBadge } from '@/components/ui/LiveBadge'
import { redirect } from 'next/navigation'
import {
  MessageSquare, Receipt, Users, Target, FileText,
  PenLine, Zap, ArrowRight, Phone, Radio,
} from 'lucide-react'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const tenantId = user.app_metadata?.tenant_id as string

  const [convResult, invoiceResult, staffResult, goalResult, recentConvs, recentDocs, workflowResult] = await Promise.all([
    supabaseAdmin.from('conversations').select('id, sentiment', { count: 'exact' }).eq('tenant_id', tenantId).eq('status', 'open'),
    supabaseAdmin.from('invoices').select('amount, status', { count: 'exact' }).eq('tenant_id', tenantId).in('status', ['unpaid', 'partial']),
    supabaseAdmin.from('staff').select('id', { count: 'exact' }).eq('tenant_id', tenantId),
    supabaseAdmin.from('goals').select('id, title, progress_pct, status').eq('tenant_id', tenantId).eq('status', 'active').order('created_at', { ascending: false }).limit(5),
    supabaseAdmin.from('conversations').select('id, contact_name, contact_identifier, intent, sentiment, updated_at, channel').eq('tenant_id', tenantId).order('updated_at', { ascending: false }).limit(10),
    supabaseAdmin.from('documents').select('id, original_filename, doc_category, processing_status, created_at').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(5),
    supabaseAdmin.from('workflow_queue').select('id', { count: 'exact' }).eq('tenant_id', tenantId).eq('status', 'pending'),
  ])

  const openConversations = convResult.count || 0
  const urgentCount = (convResult.data || []).filter((c) => c.sentiment === 'urgent' || c.sentiment === 'negative').length
  const overdueInvoices = invoiceResult.count || 0
  const totalDebt = (invoiceResult.data || []).reduce((sum, inv) => sum + Number(inv.amount), 0)
  const staffCount = staffResult.count || 0
  const goals = goalResult.data || []
  const pendingWorkflows = workflowResult.count || 0

  type ActivityType = 'conversation' | 'document' | 'invoice' | 'workflow'
  const initialActivity = [
    ...(recentConvs.data || []).slice(0, 5).map((c) => ({
      id: `c-${c.id}`,
      type: 'conversation' as ActivityType,
      label: `Message from ${c.contact_name || c.contact_identifier || 'unknown'}`,
      sub: c.channel || 'whatsapp',
      time: new Date(c.updated_at),
    })),
    ...(recentDocs.data || []).filter((d) => d.processing_status === 'done').slice(0, 3).map((d) => ({
      id: `d-${d.id}`,
      type: 'document' as ActivityType,
      label: `${d.original_filename || 'Document'} processed`,
      sub: d.doc_category || 'document',
      time: new Date(d.created_at),
    })),
  ].sort((a, b) => b.time.getTime() - a.time.getTime()).slice(0, 12)

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const firstName = user.user_metadata?.full_name?.split(' ')[0] || user.email?.split('@')[0] || 'there'
  const dateStr = new Date().toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long' })

  // Load shedding (non-blocking)
  let loadSheddingStage = '0'
  if (process.env.ESKOMSEPUSH_API_KEY) {
    try {
      const lsRes = await fetch('https://developer.sepush.co.za/business/2.0/status', {
        headers: { Token: process.env.ESKOMSEPUSH_API_KEY },
        next: { revalidate: 900 },
      })
      if (lsRes.ok) {
        const lsData = await lsRes.json() as { status: { eskom: { stage: string } } }
        loadSheddingStage = lsData.status?.eskom?.stage || '0'
      }
    } catch { /* non-critical */ }
  }

  const sentimentStyle: Record<string, { bg: string; text: string }> = {
    positive: { bg: 'rgba(34,197,94,0.12)',  text: '#22C55E' },
    neutral:  { bg: 'var(--surface-2)',       text: 'var(--text-muted)' },
    negative: { bg: 'rgba(239,68,68,0.12)',   text: '#EF4444' },
    urgent:   { bg: 'rgba(239,68,68,0.12)',   text: '#EF4444' },
  }

  const avgGoalProgress = goals.length
    ? Math.round(goals.reduce((s, g) => s + (g.progress_pct || 0), 0) / goals.length)
    : 0

  return (
    <div className="animate-fade-in">
      <TopBar
        title="Dashboard"
        subtitle={dateStr}
        actions={<LiveBadge label="Live" />}
      />

      <div className="p-6 space-y-6">

        {/* Morning brief */}
        <div
          className="rounded-2xl px-6 py-5 relative overflow-hidden border"
          style={{
            background: 'linear-gradient(135deg, #111936 0%, #1a2347 100%)',
            borderColor: 'var(--border)',
          }}
        >
          <div className="absolute inset-0 opacity-20 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse at 80% 50%, #6366F1 0%, transparent 60%)' }} />
          <div className="relative flex items-center justify-between gap-4">
            <div>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{greeting}, {firstName}</p>
              <h2 className="text-xl font-semibold mt-0.5" style={{ color: 'var(--text-primary)' }}>
                {urgentCount > 0
                  ? `${urgentCount} urgent conversation${urgentCount !== 1 ? 's' : ''} need attention`
                  : openConversations > 0
                  ? `${openConversations} open conversation${openConversations !== 1 ? 's' : ''} across your channels`
                  : 'All caught up — no open conversations'}
              </h2>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                {overdueInvoices > 0 ? `R${totalDebt.toLocaleString()} in outstanding invoices · ` : ''}
                {pendingWorkflows > 0 ? `${pendingWorkflows} workflows queued` : 'All agents active'}
              </p>
            </div>
            <div className="hidden lg:flex items-center gap-3 shrink-0">
              {loadSheddingStage !== '0' && (
                <div
                  className="text-xs px-3 py-1.5 rounded-full border font-medium"
                  style={{
                    background: 'rgba(245,158,11,0.12)',
                    borderColor: 'rgba(245,158,11,0.25)',
                    color: '#F59E0B',
                  }}
                >
                  ⚡ Stage {loadSheddingStage} active
                </div>
              )}
              <Link
                href="/dashboard/inbox"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:opacity-90"
                style={{ background: 'var(--indigo)', color: '#fff' }}
              >
                View Inbox <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>

        {/* KPI stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Open Conversations"
            value={openConversations}
            change={urgentCount > 0 ? `${urgentCount} urgent` : 'All normal'}
            changeType={urgentCount > 0 ? 'down' : 'up'}
            icon={<MessageSquare className="w-4 h-4" style={{ color: 'var(--indigo-light)' }} />}
            sparkline={[3,5,4,7,6,openConversations || 4]}
            accentColor="var(--indigo)"
          />
          <StatCard
            label="Outstanding Debt"
            value={Math.round(totalDebt)}
            change={`${overdueInvoices} overdue`}
            changeType={overdueInvoices > 0 ? 'down' : 'up'}
            icon={<Receipt className="w-4 h-4" style={{ color: '#F59E0B' }} />}
            sparkline={[2,4,3,5,3,overdueInvoices || 2]}
            prefix="R"
            accentColor="#F59E0B"
          />
          <StatCard
            label="Team Members"
            value={staffCount}
            change="Active staff"
            changeType="neutral"
            icon={<Users className="w-4 h-4" style={{ color: '#22C55E' }} />}
            sparkline={[staffCount,staffCount,staffCount,staffCount,staffCount,staffCount]}
            accentColor="#22C55E"
          />
          <StatCard
            label="Goal Progress"
            value={avgGoalProgress}
            change={`${goals.length} active goal${goals.length !== 1 ? 's' : ''}`}
            changeType={avgGoalProgress >= 60 ? 'up' : 'neutral'}
            icon={<Target className="w-4 h-4" style={{ color: '#A78BFA' }} />}
            sparkline={[20,35,45,55,65,avgGoalProgress || 50]}
            suffix="%"
            accentColor="#A78BFA"
          />
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left col — conversations + goals */}
          <div className="lg:col-span-2 space-y-5">

            {/* Recent conversations */}
            <div className="glass rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
                <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                  Recent Conversations
                </h3>
                <Link href="/dashboard/inbox" className="text-xs font-medium transition-colors"
                  style={{ color: 'var(--indigo-light)' }}>
                  View all →
                </Link>
              </div>
              <div>
                {(recentConvs.data || []).map((conv) => (
                  <Link
                    key={conv.id}
                    href={`/dashboard/inbox?id=${conv.id}`}
                    className="flex items-center gap-3 px-5 py-3 transition-all border-b"
                    style={{ borderColor: 'var(--border)' }}
                    onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = 'var(--surface-hover)')}
                    onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
                  >
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold shrink-0"
                      style={{ background: 'var(--indigo-muted)', color: 'var(--indigo-light)' }}
                    >
                      {(conv.contact_name || conv.contact_identifier || '?')[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                        {conv.contact_name || conv.contact_identifier || 'Unknown'}
                      </p>
                      <p className="text-xs capitalize" style={{ color: 'var(--text-muted)' }}>
                        {conv.intent || 'general'} · {conv.channel}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {conv.sentiment && (() => {
                        const s = sentimentStyle[conv.sentiment] ?? sentimentStyle.neutral
                        return (
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded font-medium capitalize"
                            style={{ background: s.bg, color: s.text }}
                          >
                            {conv.sentiment}
                          </span>
                        )
                      })()}
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {new Date(conv.updated_at).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </Link>
                ))}
                {(!recentConvs.data || recentConvs.data.length === 0) && (
                  <div className="px-5 py-10 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                    No conversations yet. Messages arrive here when customers contact you via WhatsApp.
                  </div>
                )}
              </div>
            </div>

            {/* Goal progress */}
            {goals.length > 0 && (
              <div className="glass rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Goal Progress</h3>
                  <Link href="/dashboard/analytics" className="text-xs font-medium"
                    style={{ color: 'var(--indigo-light)' }}>
                    Full analytics →
                  </Link>
                </div>
                <div className="space-y-3">
                  {goals.map((goal) => {
                    const pct = Math.min(goal.progress_pct || 0, 100)
                    const barColor = pct >= 75 ? 'var(--success)' : pct >= 40 ? 'var(--warning)' : 'var(--indigo)'
                    return (
                      <div key={goal.id}>
                        <div className="flex justify-between items-center mb-1.5">
                          <p className="text-sm truncate pr-3" style={{ color: 'var(--text-secondary)' }}>{goal.title}</p>
                          <span className="text-xs font-semibold shrink-0" style={{ color: 'var(--text-primary)' }}>{Math.round(pct)}%</span>
                        </div>
                        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${pct}%`, background: barColor }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Right col — agents, activity, quick actions */}
          <div className="space-y-4">

            {/* Agent status rail */}
            <div className="glass rounded-2xl p-4">
              <p className="text-[10px] uppercase tracking-wider mb-3 font-medium"
                style={{ color: 'var(--text-muted)' }}>
                Active Agents
              </p>
              <div className="space-y-2">
                {[
                  { name: 'Alex',    role: 'Sales',       icon: '💼', color: '#6366F1' },
                  { name: 'Chase',   role: 'Debt',        icon: '💰', color: '#F59E0B' },
                  { name: 'Care',    role: 'Support',     icon: '💬', color: '#22C55E' },
                  { name: 'Doc',     role: 'Documents',   icon: '📄', color: '#38BDF8' },
                  { name: 'Insight', role: 'Analytics',   icon: '📊', color: '#A78BFA' },
                  { name: 'Pen',     role: 'Email',       icon: '✉️',  color: '#C9A84C' },
                ].map((agent) => (
                  <div key={agent.name} className="flex items-center gap-2.5">
                    <span className="text-sm">{agent.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{agent.name}</p>
                      <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{agent.role}</p>
                    </div>
                    <span className="live-dot" style={{ background: agent.color }} />
                  </div>
                ))}
              </div>
            </div>

            {/* Live activity feed */}
            <div className="glass rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] uppercase tracking-wider font-medium" style={{ color: 'var(--text-muted)' }}>
                  Live Activity
                </p>
                <LiveBadge />
              </div>
              <LiveActivityFeed initial={initialActivity} />
            </div>

            {/* Quick actions */}
            <div className="glass rounded-2xl p-4">
              <p className="text-[10px] uppercase tracking-wider mb-3 font-medium"
                style={{ color: 'var(--text-muted)' }}>
                Quick Actions
              </p>
              <div className="grid grid-cols-2 gap-2">
                <QuickAction href="/dashboard/documents"       icon={<FileText className="w-4 h-4" />}   label="Upload Doc"  />
                <QuickAction href="/dashboard/email-studio"    icon={<PenLine className="w-4 h-4" />}    label="Write Email" />
                <QuickAction href="/dashboard/invoices"        icon={<Receipt className="w-4 h-4" />}    label="Invoices"    />
                <QuickAction href="/dashboard/sequences"       icon={<Zap className="w-4 h-4" />}        label="Sequences"   />
                <QuickAction href="/dashboard/reach"           icon={<Radio className="w-4 h-4" />}      label="Broadcast"   />
                <QuickAction href="/dashboard/ring"            icon={<Phone className="w-4 h-4" />}      label="Ring"        />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function QuickAction({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center gap-1.5 p-3 rounded-xl text-center transition-all"
      style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.background = 'var(--indigo-muted)'
        ;(e.currentTarget as HTMLElement).style.color = 'var(--indigo-light)'
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'
        ;(e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'
      }}
    >
      {icon}
      <span className="text-xs font-medium">{label}</span>
    </Link>
  )
}
