import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { TopBar } from '@/components/dashboard/TopBar'
import { StatCard } from '@/components/dashboard/StatCard'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const tenantId = user.user_metadata?.tenant_id as string

  // Fetch stats in parallel
  const [convResult, invoiceResult, staffResult, goalResult] = await Promise.all([
    supabaseAdmin
      .from('conversations')
      .select('id, status, sentiment', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .eq('status', 'open'),
    supabaseAdmin
      .from('invoices')
      .select('amount, days_overdue', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .in('status', ['unpaid', 'partial'])
      .gt('days_overdue', 0),
    supabaseAdmin
      .from('staff')
      .select('id', { count: 'exact' })
      .eq('tenant_id', tenantId),
    supabaseAdmin
      .from('goals')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  const openConversations = convResult.count || 0
  const overdueInvoices = invoiceResult.count || 0
  const totalDebt = (invoiceResult.data || []).reduce((sum, inv) => sum + Number(inv.amount), 0)
  const staffCount = staffResult.count || 0
  const goals = goalResult.data || []

  // Load shedding status (EskomSePush API — non-blocking)
  let loadSheddingStage: string | null = null
  let loadSheddingNote: string | null  = null
  if (process.env.ESKOMSEPUSH_API_KEY) {
    try {
      const lsRes = await fetch('https://developer.sepush.co.za/business/2.0/status', {
        headers: { Token: process.env.ESKOMSEPUSH_API_KEY },
        next: { revalidate: 900 }, // cache 15 min — API has call limits
      })
      if (lsRes.ok) {
        const lsData = await lsRes.json() as { status: { eskom: { stage: string; stage_updated: string } } }
        loadSheddingStage = lsData.status?.eskom?.stage || '0'
        const updated = lsData.status?.eskom?.stage_updated
        if (updated) {
          loadSheddingNote = `Updated ${new Date(updated).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}`
        }
      }
    } catch {
      // Non-critical — load shedding widget just won't show
    }
  }

  // Recent conversations
  const { data: recentConvs } = await supabaseAdmin
    .from('conversations')
    .select('id, contact_name, contact_identifier, intent, sentiment, updated_at, channel')
    .eq('tenant_id', tenantId)
    .order('updated_at', { ascending: false })
    .limit(8)

  const sentimentBadge: Record<string, { variant: 'green' | 'yellow' | 'red' | 'blue' | 'gray'; label: string }> = {
    positive: { variant: 'green', label: 'Positive' },
    neutral: { variant: 'gray', label: 'Neutral' },
    negative: { variant: 'red', label: 'Negative' },
    urgent: { variant: 'red', label: 'Urgent' },
  }

  return (
    <div>
      <TopBar
        title="Dashboard"
        subtitle={`${new Date().toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long' })}`}
      />

      <div className="p-6 space-y-6">
        {/* Stats row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Open Conversations"
            value={openConversations}
            icon="💬"
            change={openConversations > 10 ? 'High volume' : 'Normal'}
            changeType={openConversations > 10 ? 'down' : 'up'}
          />
          <StatCard
            label="Overdue Invoices"
            value={overdueInvoices}
            icon="💰"
            change={overdueInvoices > 0 ? `R${totalDebt.toLocaleString()} outstanding` : 'All clear'}
            changeType={overdueInvoices > 0 ? 'down' : 'up'}
          />
          <StatCard
            label="Total Staff"
            value={staffCount}
            icon="👥"
          />
          <StatCard
            label="Active Goals"
            value={goals.length}
            icon="🎯"
          />
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent activity */}
          <div className="lg:col-span-2">
            <Card padding="none">
              <div className="p-5 border-b border-gray-100">
                <h3 className="font-semibold text-gray-900">Recent Conversations</h3>
              </div>
              <div className="divide-y divide-gray-50">
                {(recentConvs || []).map((conv) => (
                  <div key={conv.id} className="px-5 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center text-sm text-emerald-700 font-medium">
                        {(conv.contact_name || conv.contact_identifier || '?')[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {conv.contact_name || conv.contact_identifier || 'Unknown'}
                        </p>
                        <p className="text-xs text-gray-500 capitalize">{conv.intent || 'general'} · {conv.channel}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {conv.sentiment && sentimentBadge[conv.sentiment] && (
                        <Badge variant={sentimentBadge[conv.sentiment].variant}>
                          {sentimentBadge[conv.sentiment].label}
                        </Badge>
                      )}
                      <span className="text-xs text-gray-400">
                        {new Date(conv.updated_at).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                ))}
                {(!recentConvs || recentConvs.length === 0) && (
                  <div className="px-5 py-8 text-center text-gray-400 text-sm">
                    No conversations yet. Messages will appear here when customers contact you via WhatsApp or email.
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Load shedding + Goals */}
          <div className="space-y-4">
            {/* Load shedding widget */}
            {process.env.ESKOMSEPUSH_API_KEY ? (
              <Card>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Load Shedding</p>
                    {loadSheddingStage === '0' ? (
                      <>
                        <p className="text-lg font-bold text-emerald-600">No load shedding</p>
                        <p className="text-xs text-gray-400 mt-0.5">Eskom Stage 0 — power is on</p>
                      </>
                    ) : (
                      <>
                        <p className="text-lg font-bold text-orange-600">Stage {loadSheddingStage}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          WhatsApp AI replies are still active during outages
                        </p>
                      </>
                    )}
                    {loadSheddingNote && (
                      <p className="text-xs text-gray-300 mt-1">{loadSheddingNote}</p>
                    )}
                  </div>
                  <span className="text-2xl">{loadSheddingStage === '0' ? '🟢' : '🟠'}</span>
                </div>
              </Card>
            ) : (
              <Card>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Load Shedding</p>
                    <p className="text-sm font-medium text-gray-700">Not configured</p>
                    <p className="text-xs text-gray-400 mt-0.5">Add ESKOMSEPUSH_API_KEY to env to enable</p>
                  </div>
                  <span className="text-2xl">⚡</span>
                </div>
              </Card>
            )}

            {/* Goals */}
            <Card>
              <CardHeader>
                <CardTitle>Company Goals</CardTitle>
                <span className="text-xs text-gray-400">This quarter</span>
              </CardHeader>
              <div className="space-y-3">
                {goals.map((goal) => (
                  <div key={goal.id}>
                    <div className="flex justify-between items-center mb-1">
                      <p className="text-sm text-gray-700 font-medium truncate pr-2">{goal.title}</p>
                      <span className="text-xs text-gray-500 shrink-0">{Math.round(goal.progress_pct || 0)}%</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all"
                        style={{ width: `${Math.min(goal.progress_pct || 0, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
                {goals.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-4">
                    Upload a strategy document to auto-extract goals.
                  </p>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
