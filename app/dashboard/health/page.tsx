import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { TopBar } from '@/components/dashboard/TopBar'
import { Card } from '@/components/ui/card'
import { redirect } from 'next/navigation'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

export const dynamic = 'force-dynamic'

type Dimensions = {
  financial?: number
  operational?: number
  team?: number
  customer?: number
  compliance?: number
  growth?: number
  [key: string]: number | undefined
}

type Snapshot = {
  id: string
  overall_score: number
  dimensions: Dimensions
  created_at: string
}

const DIMENSION_LABELS: { key: keyof Dimensions; label: string; color: string }[] = [
  { key: 'financial',   label: 'Financial',   color: '#22C55E' },
  { key: 'operational', label: 'Operational', color: '#6366F1' },
  { key: 'team',        label: 'Team',        color: '#F59E0B' },
  { key: 'customer',    label: 'Customer',    color: '#38BDF8' },
  { key: 'compliance',  label: 'Compliance',  color: '#A78BFA' },
  { key: 'growth',      label: 'Growth',      color: '#EC4899' },
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

function DimensionBar({ label, score, color }: { label: string; score: number; color: string }) {
  const pct = Math.max(0, Math.min(100, score))
  return (
    <div>
      <div className="flex justify-between items-center mb-1.5">
        <p className="text-sm text-[var(--text-secondary)] font-medium">{label}</p>
        <span className="text-sm font-bold text-[var(--text-primary)]">{pct}</span>
      </div>
      <div className="h-2 rounded-full bg-[var(--surface-2)] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  )
}

export default async function HealthPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const tenantId = user.app_metadata?.tenant_id as string

  // Real column is dimension_details — aliased so render (latest.dimensions) holds.
  const { data: snapshots } = await supabaseAdmin
    .from('business_health_snapshots')
    .select('id, overall_score, dimensions:dimension_details, created_at')
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

  const dimensions: Dimensions = latest?.dimensions ?? {}

  return (
    <div>
      <TopBar
        title="Business Health"
        subtitle="Holistic health score across 6 dimensions"
      />
      <div className="p-6 space-y-6">

        {!latest ? (
          <Card>
            <div className="text-center py-12 text-[var(--text-dim)]">
              <p className="text-3xl mb-2">🩺</p>
              <p className="text-sm">No health snapshots yet. The system generates scores weekly.</p>
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
                    {TrendIcon && scoreDelta !== null && (
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                          scoreDelta > 0
                            ? 'bg-emerald-100 text-emerald-700'
                            : scoreDelta < 0
                            ? 'bg-red-100 text-red-700'
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
                  <div className="mt-4 grid grid-cols-3 gap-2">
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

            {/* Dimension progress bars */}
            <Card>
              <h3 className="font-semibold text-[var(--text-primary)] mb-5">Dimension Breakdown</h3>
              <div className="space-y-4">
                {DIMENSION_LABELS.map(({ key, label, color }) => (
                  <DimensionBar
                    key={key}
                    label={label}
                    score={dimensions[key] ?? 0}
                    color={color}
                  />
                ))}
              </div>
            </Card>

            {/* Score trend table */}
            {trend.length > 1 && (
              <Card>
                <h3 className="font-semibold text-[var(--text-primary)] mb-4">Score Trend (Last {trend.length} Snapshots)</h3>
                <div className="overflow-x-auto">
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
                        const dims: Dimensions = snap.dimensions ?? {}
                        const isLatest = i === trend.length - 1
                        return (
                          <tr
                            key={snap.id}
                            className={isLatest ? 'bg-indigo-500/15 font-semibold' : 'hover:bg-[var(--surface-hover)]'}
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
                            <td className="py-2 text-right text-[var(--text-muted)]">{dims.financial ?? '—'}</td>
                            <td className="py-2 text-right text-[var(--text-muted)]">{dims.operational ?? '—'}</td>
                            <td className="py-2 text-right text-[var(--text-muted)]">{dims.team ?? '—'}</td>
                            <td className="py-2 text-right text-[var(--text-muted)]">{dims.compliance ?? '—'}</td>
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
