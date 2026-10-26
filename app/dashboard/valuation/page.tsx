import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { TopBar } from '@/components/dashboard/TopBar'
import { Card } from '@/components/ui/card'
import { redirect, notFound } from 'next/navigation'
import { RefreshButton } from '@/components/ui/RefreshButton'
import { checkPermission } from '@/lib/auth/permissions'

type Driver = {
  teachable: number
  valuable: number
  repeatable: number
  scalable: number
  recurring: number
  warnings?: string[]
}

type ValuationSnapshot = {
  id: string
  tenant_id: string
  valuation_estimate: number
  drivers: Driver
  methodology: string
  created_at: string
}

type DriverKey = 'teachable' | 'valuable' | 'repeatable' | 'scalable' | 'recurring'

// Each driver is scored out of 20 by lib/intelligence/valuation.ts.
const DRIVER_LABELS: Record<DriverKey, string> = {
  teachable: 'Documented & teachable (SOPs)',
  valuable: 'Consistent demand (business health)',
  repeatable: 'Repeatable delivery (invoice volume)',
  scalable: 'Scalable (team size)',
  recurring: 'Recurring revenue (repeat clients)',
}

const DRIVER_COLORS: Record<DriverKey, string> = {
  teachable: 'bg-emerald-500',
  valuable: 'bg-blue-500',
  repeatable: 'bg-cyan-500',
  scalable: 'bg-violet-500',
  recurring: 'bg-orange-500',
}

function formatValuation(val: number): string {
  if (val >= 1_000_000) return `R${(val / 1_000_000).toFixed(2)}M`
  if (val >= 1_000) return `R${(val / 1_000).toFixed(1)}K`
  return `R${val.toLocaleString('en-ZA')}`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-ZA', {
    timeZone: 'Africa/Johannesburg',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export default async function ValuationPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // An estimate of what the business is worth — arguably the single most
  // exit/ownership-sensitive page in the dashboard. Same view_financials
  // boundary as the rest of the money-facing pages. notFound(), not a
  // redirect, per the page-level denial convention in lib/auth/context.ts.
  if (!(await checkPermission('view_financials'))) notFound()

  const tenantId = user.app_metadata?.tenant_id as string

  // Real columns: estimated_value / exit_details / sector — aliased so the
  // render (valuation_estimate / drivers / methodology) is unchanged.
  const { data: snapshots } = await supabaseAdmin
    .from('valuation_snapshots')
    .select('id, tenant_id, valuation_estimate:estimated_value, drivers:exit_details, methodology:sector, created_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(5)

  const allSnaps = (snapshots || []) as ValuationSnapshot[]
  const latest = allSnaps[0] ?? null
  const trend = allSnaps.slice(1)

  const drivers = latest?.drivers ?? null

  return (
    <div>
      <TopBar title="Business Valuation" subtitle="Understand and grow your business value" />
      <div className="p-4 md:p-6 space-y-6">

        {/* Big number */}
        <Card>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <p className="text-sm text-[var(--text-muted)] mb-1">Estimated Valuation</p>
              {latest ? (
                <>
                  <p className="text-5xl font-extrabold text-emerald-400 tracking-tight">
                    {formatValuation(latest.valuation_estimate)}
                  </p>
                  <p className="text-xs text-[var(--text-dim)] mt-1">
                    Calculated {formatDate(latest.created_at)} · {latest.methodology}
                  </p>
                </>
              ) : (
                <p className="text-3xl font-bold text-[var(--text-dim)]">No snapshot yet</p>
              )}
            </div>
            <RefreshButton endpoint="/api/valuation?refresh=true" label="Recalculate" />
          </div>

          {/* Trend line (sparkline-style) */}
          {trend.length > 0 && (
            <div className="mt-5 pt-5 border-t border-[var(--border)]">
              <p className="text-xs text-[var(--text-dim)] mb-3">Prior snapshots</p>
              <div className="flex items-end gap-2">
                {[...trend].reverse().map((snap) => {
                  const maxVal = Math.max(...allSnaps.map((s) => s.valuation_estimate), 1)
                  const height = Math.round((snap.valuation_estimate / maxVal) * 60)
                  return (
                    <div key={snap.id} className="flex flex-col items-center gap-1 group relative">
                      <div
                        className="w-10 rounded-t bg-emerald-200 hover:bg-emerald-400 transition-colors cursor-default"
                        style={{ height: `${Math.max(height, 6)}px` }}
                        title={formatValuation(snap.valuation_estimate)}
                      />
                      <p className="text-xs text-[var(--text-dim)]">
                        {new Date(snap.created_at).toLocaleDateString('en-ZA', { timeZone: 'Africa/Johannesburg', month: 'short' })}
                      </p>
                    </div>
                  )
                })}
                {latest && (
                  <div className="flex flex-col items-center gap-1">
                    <div
                      className="w-10 rounded-t bg-emerald-700 cursor-default"
                      style={{ height: '60px' }}
                      title={`Latest: ${formatValuation(latest.valuation_estimate)}`}
                    />
                    <p className="text-xs font-semibold text-emerald-400">Now</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </Card>

        {/* 7 Value Drivers */}
        <Card>
          <h3 className="font-semibold text-[var(--text-primary)] mb-5">5 Value Drivers</h3>
          {drivers ? (
            <div className="space-y-4">
              {(Object.keys(DRIVER_LABELS) as DriverKey[]).map((key) => {
                const score = drivers[key] ?? 0
                const pct = Math.round((Math.min(Math.max(score, 0), 20) / 20) * 100)
                const color = DRIVER_COLORS[key]
                return (
                  <div key={key}>
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <span className="text-[var(--text-secondary)] font-medium">{DRIVER_LABELS[key]}</span>
                      <span className="text-[var(--text-muted)] font-semibold tabular-nums">{pct}%</span>
                    </div>
                    <div className="h-2.5 bg-[var(--surface-2)] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${color}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
              {drivers.warnings && drivers.warnings.length > 0 && (
                <ul className="pt-2 space-y-1.5 text-sm text-amber-400">
                  {drivers.warnings.map((w) => <li key={w}>⚠ {w}</li>)}
                </ul>
              )}
            </div>
          ) : (
            <div className="text-center py-10 text-[var(--text-dim)]">
              <p className="text-4xl mb-3">📊</p>
              <p className="text-sm">No valuation data yet. Click Recalculate to generate your first snapshot.</p>
            </div>
          )}
        </Card>

        {/* Methodology note */}
        {latest?.methodology && (
          <Card>
            <h3 className="font-semibold text-[var(--text-primary)] mb-2">Methodology</h3>
            <p className="text-sm text-[var(--text-muted)]">{latest.methodology}</p>
            <p className="text-xs text-[var(--text-dim)] mt-3">
              Valuations are estimates based on available financial data. Consult a professional valuator for legal or investment purposes.
            </p>
          </Card>
        )}

      </div>
    </div>
  )
}
