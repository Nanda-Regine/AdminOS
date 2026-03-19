import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { TopBar } from '@/components/dashboard/TopBar'
import { StatCard } from '@/components/dashboard/StatCard'
import { Card } from '@/components/ui/card'
import { redirect } from 'next/navigation'

type WellnessEntry = { score: number; date: string }

// Build last N days date labels
function lastNDays(n: number): string[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (n - 1 - i))
    return d.toISOString().split('T')[0]
  })
}

export default async function AnalyticsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const tenantId = user.user_metadata?.tenant_id as string

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const [convStats, messageStats, invoiceStats, wellnessStats] = await Promise.all([
    supabaseAdmin
      .from('conversations')
      .select('id, status, channel, sentiment, intent, created_at')
      .eq('tenant_id', tenantId)
      .gte('created_at', thirtyDaysAgo.toISOString()),
    supabaseAdmin
      .from('messages')
      .select('from_cache, tokens_used, created_at')
      .eq('tenant_id', tenantId)
      .eq('role', 'assistant')
      .gte('created_at', thirtyDaysAgo.toISOString()),
    supabaseAdmin
      .from('invoices')
      .select('amount, amount_paid, status, due_date')
      .eq('tenant_id', tenantId),
    supabaseAdmin
      .from('staff')
      .select('wellness_scores, full_name')
      .eq('tenant_id', tenantId),
  ])

  const conversations = convStats.data   || []
  const messages      = messageStats.data || []
  const invoices      = invoiceStats.data || []
  const staff         = wellnessStats.data || []

  // ── KPI calculations ──────────────────────────────────────────────────
  const autoResolved    = conversations.filter((c) => c.status === 'auto_resolved').length
  const autoResolveRate = conversations.length > 0
    ? Math.round((autoResolved / conversations.length) * 100) : 0

  const cacheHits    = messages.filter((m) => m.from_cache).length
  const cacheHitRate = messages.length > 0 ? Math.round((cacheHits / messages.length) * 100) : 0
  const totalTokens  = messages.reduce((sum, m) => sum + (m.tokens_used || 0), 0)

  const paidInvoices   = invoices.filter((i) => i.status === 'paid')
  const unpaidInvoices = invoices.filter((i) => i.status !== 'paid')
  const revenue        = paidInvoices.reduce((sum, i) => sum + Number(i.amount), 0)
  const outstanding    = unpaidInvoices.reduce((sum, i) => sum + Number(i.amount) - Number(i.amount_paid), 0)
  const collectionRate = (revenue + outstanding) > 0
    ? Math.round((revenue / (revenue + outstanding)) * 100) : 0

  // Team wellness average (last 7 entries per staff member)
  const allWellnessScores = staff.flatMap((s) =>
    ((s.wellness_scores || []) as WellnessEntry[]).slice(-7)
  )
  const wellnessAvg = allWellnessScores.length > 0
    ? (allWellnessScores.reduce((sum, s) => sum + s.score, 0) / allWellnessScores.length).toFixed(1)
    : null

  // ── Daily conversation volume (last 14 days) ───────────────────────────
  const days14 = lastNDays(14)
  const volumeByDay: Record<string, number> = Object.fromEntries(days14.map((d) => [d, 0]))
  for (const c of conversations) {
    const day = c.created_at.split('T')[0]
    if (day in volumeByDay) volumeByDay[day]++
  }
  const maxVolume = Math.max(...Object.values(volumeByDay), 1)

  // ── Intent breakdown ──────────────────────────────────────────────────
  const intentBreakdown = conversations.reduce((acc: Record<string, number>, c) => {
    const intent = c.intent || 'general'
    acc[intent] = (acc[intent] || 0) + 1
    return acc
  }, {})
  const topIntents = Object.entries(intentBreakdown)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
  const maxIntentCount = Math.max(...topIntents.map(([, v]) => v), 1)

  // ── Sentiment breakdown ───────────────────────────────────────────────
  const sentimentBreakdown = conversations.reduce((acc: Record<string, number>, c) => {
    const s = c.sentiment || 'neutral'
    acc[s] = (acc[s] || 0) + 1
    return acc
  }, {})

  const sentimentColors: Record<string, string> = {
    positive: 'bg-green-500',
    neutral:  'bg-gray-400',
    negative: 'bg-red-500',
    urgent:   'bg-orange-500',
  }

  // ── Debt aging buckets ────────────────────────────────────────────────
  const today = new Date()
  const aging = { current: 0, '1-30': 0, '31-60': 0, '61-90': 0, '90+': 0 }
  for (const inv of unpaidInvoices) {
    if (!inv.due_date) { aging.current++; continue }
    const daysOverdue = Math.floor((today.getTime() - new Date(inv.due_date).getTime()) / 86_400_000)
    if (daysOverdue <= 0)       aging.current++
    else if (daysOverdue <= 30) aging['1-30']++
    else if (daysOverdue <= 60) aging['31-60']++
    else if (daysOverdue <= 90) aging['61-90']++
    else                        aging['90+']++
  }
  const maxAging = Math.max(...Object.values(aging), 1)

  return (
    <div>
      <TopBar title="Analytics" subtitle="Last 30 days business intelligence" />
      <div className="p-6 space-y-6">

        {/* KPI row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Conversations (30d)"
            value={conversations.length}
            icon="💬"
          />
          <StatCard
            label="Auto-resolve rate"
            value={`${autoResolveRate}%`}
            icon="🤖"
            change="AI efficiency"
            changeType={autoResolveRate > 70 ? 'up' : 'neutral'}
          />
          <StatCard
            label="Collection rate"
            value={`${collectionRate}%`}
            icon="💰"
            change={`R${outstanding.toLocaleString()} outstanding`}
            changeType={collectionRate > 80 ? 'up' : collectionRate < 50 ? 'down' : 'neutral'}
          />
          <StatCard
            label="Team wellness"
            value={wellnessAvg ? `${wellnessAvg} / 5` : 'No data'}
            icon="💚"
            changeType={Number(wellnessAvg) >= 3.5 ? 'up' : wellnessAvg ? 'down' : 'neutral'}
          />
        </div>

        {/* Daily volume chart */}
        <Card>
          <h3 className="font-semibold text-gray-900 mb-5">Daily Conversation Volume — Last 14 Days</h3>
          <div className="flex items-end gap-1.5 h-32">
            {days14.map((day) => {
              const count  = volumeByDay[day] || 0
              const height = maxVolume > 0 ? Math.round((count / maxVolume) * 100) : 0
              const label  = new Date(day + 'T12:00:00').toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric' })
              return (
                <div key={day} className="flex-1 flex flex-col items-center gap-1 group relative">
                  {count > 0 && (
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 hidden group-hover:block bg-gray-900 text-white text-xs rounded px-1.5 py-0.5 whitespace-nowrap z-10">
                      {count} conv
                    </div>
                  )}
                  <div className="w-full flex items-end justify-center flex-1">
                    <div
                      className="w-full rounded-t-sm bg-emerald-500 transition-all duration-300 min-h-[2px]"
                      style={{ height: `${Math.max(height, count > 0 ? 4 : 1)}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-400 truncate w-full text-center" title={label}>
                    {label.split(' ')[0]}
                  </p>
                </div>
              )
            })}
          </div>
          <div className="mt-3 flex items-center gap-3 text-xs text-gray-400">
            <span>Total: {conversations.length} conversations</span>
            <span>·</span>
            <span>Cache hit: {cacheHitRate}%</span>
            <span>·</span>
            <span>{totalTokens.toLocaleString()} tokens</span>
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Top intents */}
          <Card>
            <h3 className="font-semibold text-gray-900 mb-4">Top Request Types</h3>
            <div className="space-y-3">
              {topIntents.length > 0 ? topIntents.map(([intent, count]) => (
                <div key={intent}>
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span className="capitalize">{intent.replace(/_/g, ' ')}</span>
                    <span className="font-medium text-gray-700">{count}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all duration-500"
                      style={{ width: `${(count / maxIntentCount) * 100}%` }}
                    />
                  </div>
                </div>
              )) : (
                <p className="text-sm text-gray-400 text-center py-3">No conversations yet</p>
              )}
            </div>
          </Card>

          {/* Sentiment breakdown */}
          <Card>
            <h3 className="font-semibold text-gray-900 mb-4">Customer Sentiment</h3>
            {Object.keys(sentimentBreakdown).length > 0 ? (
              <div className="space-y-3">
                {Object.entries(sentimentBreakdown).map(([sentiment, count]) => (
                  <div key={sentiment}>
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span className="capitalize">{sentiment}</span>
                      <span className="font-medium text-gray-700">
                        {count} ({conversations.length > 0 ? Math.round((count / conversations.length) * 100) : 0}%)
                      </span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${sentimentColors[sentiment] || 'bg-gray-400'}`}
                        style={{ width: `${(count / conversations.length) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-3">No sentiment data yet</p>
            )}
          </Card>

          {/* Debt aging */}
          <Card>
            <h3 className="font-semibold text-gray-900 mb-4">Debt Aging</h3>
            <div className="space-y-3">
              {Object.entries(aging).map(([bucket, count]) => (
                <div key={bucket}>
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>{bucket === 'current' ? 'Current (not due)' : `${bucket} days`}</span>
                    <span className="font-medium text-gray-700">{count} invoices</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        bucket === 'current' ? 'bg-emerald-500' :
                        bucket === '1-30'    ? 'bg-yellow-400' :
                        bucket === '31-60'   ? 'bg-orange-400' : 'bg-red-500'
                      }`}
                      style={{ width: `${(count / maxAging) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-3 border-t border-gray-100">
              <p className="text-xs text-gray-500">Revenue collected</p>
              <p className="text-xl font-bold text-emerald-600 mt-0.5">
                R{revenue.toLocaleString()}
                <span className="text-sm font-normal text-gray-400 ml-1">
                  from {paidInvoices.length} invoices
                </span>
              </p>
            </div>
          </Card>
        </div>

      </div>
    </div>
  )
}
