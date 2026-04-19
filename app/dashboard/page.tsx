import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { TopBar } from '@/components/dashboard/TopBar'
import { LiveActivityFeed } from '@/components/dashboard/LiveActivityFeed'
import { AgentStatusBar } from '@/components/dashboard/AgentStatusBar'
import { redirect } from 'next/navigation'
import {
  MessageSquare, Receipt, Users, Target, TrendingUp, TrendingDown,
  Zap, ArrowRight, FileText, PenLine,
} from 'lucide-react'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const tenantId = user.user_metadata?.tenant_id as string

  const [convResult, invoiceResult, staffResult, goalResult, recentConvs, recentDocs, workflowResult] = await Promise.all([
    supabaseAdmin.from('conversations').select('id, sentiment', { count: 'exact' }).eq('tenant_id', tenantId).eq('status', 'open'),
    supabaseAdmin.from('invoices').select('amount, days_overdue, status', { count: 'exact' }).eq('tenant_id', tenantId).in('status', ['unpaid', 'partial']),
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

  // Build initial activity feed from recent conversations + docs
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

  // Morning brief message
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const firstName = user.user_metadata?.full_name?.split(' ')[0] || user.email?.split('@')[0] || 'there'

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

  const sentimentColor: Record<string, string> = {
    positive: 'bg-emerald-100 text-emerald-700',
    neutral: 'bg-gray-100 text-gray-600',
    negative: 'bg-red-100 text-red-700',
    urgent: 'bg-red-100 text-red-700',
  }

  return (
    <div>
      <TopBar
        title="Dashboard"
        subtitle={`${new Date().toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`}
      />

      <div className="p-6 space-y-6">

        {/* Morning brief banner */}
        <div className="bg-gradient-to-r from-[#0A0F2C] to-[#1a2550] rounded-2xl px-6 py-5 flex items-center justify-between">
          <div>
            <p className="text-white/50 text-sm">{greeting}, {firstName}</p>
            <h2 className="text-white text-xl font-semibold mt-0.5">
              {urgentCount > 0
                ? `${urgentCount} urgent ${urgentCount === 1 ? 'conversation needs' : 'conversations need'} your attention`
                : openConversations > 0
                ? `${openConversations} open ${openConversations === 1 ? 'conversation' : 'conversations'} across your channels`
                : 'All caught up — no open conversations'}
            </h2>
            <p className="text-white/40 text-sm mt-1">
              {overdueInvoices > 0 ? `R${totalDebt.toLocaleString()} in outstanding invoices · ` : ''}
              {pendingWorkflows > 0 ? `${pendingWorkflows} workflows queued` : 'All agents active'}
            </p>
          </div>
          <div className="hidden lg:flex items-center gap-3">
            {loadSheddingStage !== '0' && (
              <div className="bg-orange-500/20 text-orange-300 text-xs px-3 py-1.5 rounded-full border border-orange-500/30">
                ⚡ Stage {loadSheddingStage} active
              </div>
            )}
            <Link
              href="/dashboard/inbox"
              className="flex items-center gap-2 bg-[#C9A84C] text-[#0A0F2C] text-sm font-semibold px-4 py-2 rounded-xl hover:bg-[#d4b558] transition-colors"
            >
              View Inbox <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Open Conversations"
            value={openConversations}
            sub={urgentCount > 0 ? `${urgentCount} urgent` : 'All normal'}
            icon={<MessageSquare className="w-5 h-5" />}
            trend={urgentCount > 0 ? 'down' : 'up'}
            href="/dashboard/inbox"
            color="blue"
          />
          <KpiCard
            label="Outstanding Debt"
            value={`R${totalDebt >= 1000 ? `${(totalDebt / 1000).toFixed(1)}k` : totalDebt.toLocaleString()}`}
            sub={`${overdueInvoices} overdue invoice${overdueInvoices !== 1 ? 's' : ''}`}
            icon={<Receipt className="w-5 h-5" />}
            trend={overdueInvoices > 0 ? 'down' : 'up'}
            href="/dashboard/invoices"
            color="amber"
          />
          <KpiCard
            label="Team Members"
            value={staffCount}
            sub="Active staff"
            icon={<Users className="w-5 h-5" />}
            trend="up"
            href="/dashboard/staff"
            color="purple"
          />
          <KpiCard
            label="Active Goals"
            value={goals.length}
            sub={goals.length > 0 ? `Avg ${Math.round(goals.reduce((s, g) => s + (g.progress_pct || 0), 0) / goals.length)}% progress` : 'No goals yet'}
            icon={<Target className="w-5 h-5" />}
            trend={goals.length > 0 ? 'up' : 'neutral'}
            href="/dashboard/analytics"
            color="green"
          />
        </div>

        {/* Main 3-col grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left: recent conversations */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
                <h3 className="font-semibold text-gray-900 text-sm">Recent Conversations</h3>
                <Link href="/dashboard/inbox" className="text-xs text-[#2D4A22] font-medium hover:underline">View all</Link>
              </div>
              <div className="divide-y divide-gray-50">
                {(recentConvs.data || []).map((conv) => (
                  <Link
                    key={conv.id}
                    href={`/dashboard/inbox?id=${conv.id}`}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-[#2D4A22]/10 flex items-center justify-center text-sm font-semibold text-[#2D4A22] shrink-0">
                      {(conv.contact_name || conv.contact_identifier || '?')[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {conv.contact_name || conv.contact_identifier || 'Unknown'}
                      </p>
                      <p className="text-xs text-gray-400 capitalize">{conv.intent || 'general'} · {conv.channel}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {conv.sentiment && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium capitalize ${sentimentColor[conv.sentiment] || 'bg-gray-100 text-gray-500'}`}>
                          {conv.sentiment}
                        </span>
                      )}
                      <span className="text-xs text-gray-300">
                        {new Date(conv.updated_at).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </Link>
                ))}
                {(!recentConvs.data || recentConvs.data.length === 0) && (
                  <div className="px-5 py-8 text-center text-gray-400 text-sm">
                    No conversations yet. Messages arrive here when customers contact you via WhatsApp.
                  </div>
                )}
              </div>
            </div>

            {/* Goals tracker */}
            {goals.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900 text-sm">Goal Progress</h3>
                  <Link href="/dashboard/analytics" className="text-xs text-[#2D4A22] font-medium hover:underline">Full analytics</Link>
                </div>
                <div className="space-y-4">
                  {goals.map((goal) => (
                    <div key={goal.id}>
                      <div className="flex justify-between items-center mb-1.5">
                        <p className="text-sm text-gray-700 truncate pr-3">{goal.title}</p>
                        <span className="text-xs font-semibold text-gray-600 shrink-0">{Math.round(goal.progress_pct || 0)}%</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.min(goal.progress_pct || 0, 100)}%`,
                            background: (goal.progress_pct || 0) >= 75
                              ? '#2D4A22'
                              : (goal.progress_pct || 0) >= 40
                              ? '#C9A84C'
                              : '#E5E7EB',
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right: live feed + quick actions */}
          <div className="space-y-4">

            {/* AI agent status */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Active Agents</p>
              <AgentStatusBar />
            </div>

            {/* Live activity feed */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Live Activity</p>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              </div>
              <LiveActivityFeed initial={initialActivity} />
            </div>

            {/* Quick actions */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Quick Actions</p>
              <div className="grid grid-cols-2 gap-2">
                <QuickAction href="/dashboard/documents" icon={<FileText className="w-4 h-4" />} label="Upload Doc" />
                <QuickAction href="/dashboard/email-studio" icon={<PenLine className="w-4 h-4" />} label="Write Email" />
                <QuickAction href="/dashboard/invoices" icon={<Receipt className="w-4 h-4" />} label="Invoices" />
                <QuickAction href="/dashboard/workflow-monitor" icon={<Zap className="w-4 h-4" />} label="Workflows" />
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}

function KpiCard({
  label, value, sub, icon, trend, href, color,
}: {
  label: string
  value: string | number
  sub: string
  icon: React.ReactNode
  trend: 'up' | 'down' | 'neutral'
  href: string
  color: 'blue' | 'amber' | 'purple' | 'green'
}) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600',
    amber: 'bg-amber-50 text-amber-600',
    purple: 'bg-purple-50 text-purple-600',
    green: 'bg-[#2D4A22]/10 text-[#2D4A22]',
  }
  return (
    <Link href={href} className="bg-white rounded-2xl border border-gray-100 p-5 hover:border-gray-200 hover:shadow-sm transition-all block">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${colors[color]}`}>
          {icon}
        </div>
        {trend === 'up' && <TrendingUp className="w-4 h-4 text-emerald-500" />}
        {trend === 'down' && <TrendingDown className="w-4 h-4 text-red-400" />}
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
      <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
    </Link>
  )
}

function QuickAction({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-gray-50 hover:bg-[#2D4A22]/5 hover:text-[#2D4A22] text-gray-600 transition-colors text-center"
    >
      {icon}
      <span className="text-xs font-medium">{label}</span>
    </Link>
  )
}
