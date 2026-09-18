import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { TopBar } from '@/components/dashboard/TopBar'
import { Card } from '@/components/ui/card'
import { redirect, notFound } from 'next/navigation'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { RefreshButton } from '@/components/ui/RefreshButton'
import { checkPermission } from '@/lib/auth/permissions'
import { HealthRadarChart, HealthTrendChart } from '@/components/dashboard/HealthCharts'

export const dynamic = 'force-dynamic'

// Six real numeric columns on business_health_snapshots (see
// saveHealthSnapshot, lib/intelligence/healthScore.ts:335-340). Deliberately
// NOT reading `dimension_details` for these scores: that JSONB column holds
// each dimension's `details` object (e.g. {totalGoals, futureGoals,
// overdueGoals} for strategic) — an object, not a 0-100 number — and would
// crash the render below if used here.
type Dimensions = {
  financial_health?: number
  operational_maturity?: number
  people_management?: number
  customer_relations?: number
  legal_compliance?: number
  strategic_readiness?: number
}

type Snapshot = Dimensions & {
  id: string
  overall_score: number
  created_at: string
}

// Colors sourced from the existing token/chip system (not arbitrary hex) so
// they stay theme-consistent between dark and light mode.
const DIMENSION_LABELS: { key: keyof Dimensions; label: string; color: string }[] = [
  { key: 'financial_health',     label: 'Financial',   color: 'var(--chip-green-fg)' },
  { key: 'operational_maturity', label: 'Operational', color: 'var(--indigo)' },
  { key: 'people_management',    label: 'Team',        color: 'var(--chip-amber-fg)' },
  { key: 'customer_relations',   label: 'Customer',    color: 'var(--chip-blue-fg)' },
  { key: 'legal_compliance',     label: 'Compliance',  color: 'var(--chip-purple-fg)' },
  { key: 'strategic_readiness',  label: 'Growth',       color: 'var(--gold)' },
]

function ScoreRing({ score }: { score: number }) {
  const clamped = Math.max(0, Math.min(100, score))
  const r = 54
  const circ = 2 * Math.PI * r
  const filled = (clamped / 100) * circ
  const color =
    clamped >= 75 ? '#22C55E' :
    clamped >= 50 ? '#F59E0B' :
    '#EF4444'

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-36 h-36">
        <svg viewBox="0 0 128 128" className="w-full h-full -rotate-90">
          <circle cx="64" cy="64" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="10" />
          <circle
            cx="64" cy="64" r={r}
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${filled} ${circ - filled}`}
            style={{ transition: 'stroke-dasharray 0.8s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold text-[var(--text-primary)]">{clamped}</span>
          <span className="text-xs text-[var(--text-muted)]">/100</span>
        </div>
      </div>
      <p className="text-sm font-semibold text-[var(--text-secondary)] mt-2">Overall Health Score</p>
    </div>
  )
}

export default async function HealthPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Cross-dimension scorecard (financial/operational/people/customer/
  // compliance/strategic) — the same rollup-analytics sensitivity as the
  // dashboard's other trend views. notFound(), matching the page-level
  // denial convention in lib/auth/context.ts.
  if (!(await checkPermission('view_analytics'))) notFound()

  const tenantId = user.app_metadata?.tenant_id as string

  const { data: snapshots } = await supabaseAdmin
    .from('business_health_snapshots')
    .select('id, overall_score, financial_health, operational_maturity, people_management, customer_relations, legal_compliance, strategic_readiness, created_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(12)

  const all = (snapshots || []) as Snapshot[]
  const latest = all[0] ?? null
  const trend = [...all].reverse() // oldest first for trend table

  // Calculate score change vs previous snapshot
  const prevScore = all[1]?.overall_score ?? null
  const scoreDelta = latest && prevScore !== null ? latest.overall_score - prevScore : null
  const TrendIcon =
    scoreDelta === null ? null :
    scoreDelta > 0 ? TrendingUp :
    scoreDelta < 0 ? TrendingDown :
    Minus

  const dimensions: Dimensions = latest ?? {}

  return (
    <div>
      <TopBar
        title="Business Health"
        subtitle="Holistic health score across 6 dimensions"
      />
      <div className="p-4 md:p-6 space-y-6">

        {!latest ? (
          <Card>
            <div className="text-center py-12 text-[var(--text-dim)]">
              <p className="text-3xl mb-2">🩺</p>
              <p className="text-sm mb-4">No health snapshots yet. The system generates scores weekly — or generate one now.</p>
              <RefreshButton endpoint="/api/health-score?refresh=true" label="Generate First Snapshot" />
            </div>
          </Card>
        ) : (
          <>
            {/* Top section: ring + delta + last updated */}
            <Card>
              <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
                <ScoreRing score={latest.overall_score} />

                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold text-[var(--text-primary)]">Health Score</h3>
                    <RefreshButton
                      endpoint="/api/health-score?refresh=true"
                      label="Refresh"
                      className="text-xs font-medium px-2.5 py-1 rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-60"
                    />
                    {TrendIcon && scoreDelta !== null && (
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                          scoreDelta > 0
                            ? 'bg-[var(--chip-green-bg)] text-[var(--chip-green-fg)]'
                            : scoreDelta < 0
                            ? 'bg-[var(--chip-red-bg)] text-[var(--chip-red-fg)]'
                            : 'bg-[var(--surface-2)] text-[var(--text-muted)]'
                        }`}
                      >
                        <TrendIcon className="w-3 h-3" />
                        {scoreDelta > 0 ? '+' : ''}{scoreDelta.toFixed(1)} vs last snapshot
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--text-muted)]">
                    Last updated:{' '}
                    {new Date(latest.created_at).toLocaleDateString('en-ZA', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </p>
                  <p className="text-xs text-[var(--text-dim)] mt-2">
                    Benchmark: South African SME average is ~55/100. Scores above 70 indicate strong business health.
                  </p>
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {DIMENSION_LABELS.map(({ key, label, color }) => {
                      const score = dimensions[key] ?? 0
                      return (
                        <div
                          key={key}
                          className="text-center p-2 bg-[var(--surface-2)] rounded-lg border border-[var(--border)]"
                        >
                          <p className="text-base font-bold" style={{ color }}>{score}</p>
                          <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{label}</p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </Card>

            {/* Dimension breakdown — radar */}
            <Card>
              <h3 className="font-semibold text-[var(--text-primary)] mb-1">Dimension Breakdown</h3>
              <p className="text-xs text-[var(--text-muted)] mb-2">How the six dimensions compare against each other right now.</p>
              <HealthRadarChart
                data={DIMENSION_LABELS.map(({ key, label }) => ({ label, score: dimensions[key] ?? 0 }))}
              />
              <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5">
                {DIMENSION_LABELS.map(({ key, label, color }) => (
                  <div key={key} className="flex items-center gap-1.5 text-xs">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                    <span className="text-[var(--text-muted)]">{label}</span>
                    <span className="ml-auto font-semibold text-[var(--text-primary)]">{dimensions[key] ?? 0}</span>
                  </div>
                ))}
              </div>
            </Card>

            {/* Score trend — line chart */}
            {trend.length > 1 && (
              <Card>
                <h3 className="font-semibold text-[var(--text-primary)] mb-4">Score Trend (Last {trend.length} Snapshots)</h3>
                <HealthTrendChart
                  data={trend.map((snap) => ({
                    label: new Date(snap.created_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' }),
                    score: snap.overall_score,
                  }))}
                />
                <div className="overflow-x-auto mt-4">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-[var(--text-muted)] border-b border-[var(--border)]">
                        <th className="pb-2 font-medium">Date</th>
                        <th className="pb-2 font-medium text-right">Overall</th>
                        <th className="pb-2 font-medium text-right">Financial</th>
                        <th className="pb-2 font-medium text-right">Operational</th>
                        <th className="pb-2 font-medium text-right">Team</th>
                        <th className="pb-2 font-medium text-right">Compliance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      {trend.map((snap, i) => {
                        const isLatest = i === trend.length - 1
                        return (
                          <tr
                            key={snap.id}
                            className={isLatest ? 'font-semibold' : 'hover:bg-[var(--surface-hover)]'}
                            style={isLatest ? { background: 'var(--indigo-muted)' } : undefined}
                          >
                            <td className="py-2 text-[var(--text-secondary)]">
                              {new Date(snap.created_at).toLocaleDateString('en-ZA', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })}
                              {isLatest && (
                                <span className="ml-1.5 text-[10px] font-normal" style={{ color: 'var(--indigo-light)' }}>
                                  (latest)
                                </span>
                              )}
                            </td>
                            <td className="py-2 text-right font-bold text-[var(--text-primary)]">{snap.overall_score}</td>
                            <td className="py-2 text-right text-[var(--text-muted)]">{snap.financial_health ?? '—'}</td>
                            <td className="py-2 text-right text-[var(--text-muted)]">{snap.operational_maturity ?? '—'}</td>
                            <td className="py-2 text-right text-[var(--text-muted)]">{snap.people_management ?? '—'}</td>
                            <td className="py-2 text-right text-[var(--text-muted)]">{snap.legal_compliance ?? '—'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  )
}
