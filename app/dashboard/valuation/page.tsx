import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { TopBar } from '@/components/dashboard/TopBar'
import { Card } from '@/components/ui/card'
import { redirect } from 'next/navigation'

type Driver = {
  revenue_growth: number
  profitability: number
  cash_flow: number
  team_quality: number
  systems: number
  ip_assets: number
  market_position: number
}

type ValuationSnapshot = {
  id: string
  tenant_id: string
  valuation_estimate: number
  drivers: Driver
  methodology: string
  created_at: string
}

const DRIVER_LABELS: Record<keyof Driver, string> = {
  revenue_growth: 'Revenue Growth',
  profitability: 'Profitability',
  cash_flow: 'Cash Flow',
  team_quality: 'Team Quality',
  systems: 'Systems & Processes',
  ip_assets: 'IP & Assets',
  market_position: 'Market Position',
}

const DRIVER_COLORS: Record<keyof Driver, string> = {
  revenue_growth: 'bg-emerald-500',
  profitability: 'bg-blue-500',
  cash_flow: 'bg-cyan-500',
  team_quality: 'bg-violet-500',
  systems: 'bg-orange-500',
  ip_assets: 'bg-pink-500',
  market_position: 'bg-yellow-500',
}

function formatValuation(val: number): string {
  if (val >= 1_000_000) return `R${(val / 1_000_000).toFixed(2)}M`
  if (val >= 1_000) return `R${(val / 1_000).toFixed(1)}K`
  return `R${val.toLocaleString('en-ZA')}`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-ZA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export default async function ValuationPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const tenantId = user.app_metadata?.tenant_id as string

  const { data: snapshots } = await supabaseAdmin
    .from('valuation_snapshots')
    .select('id, tenant_id, valuation_estimate, drivers, methodology, created_at')
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
      <div className="p-6 space-y-6">

        {/* Big number */}
        <Card>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <p className="text-sm text-gray-500 mb-1">Estimated Valuation</p>
              {latest ? (
                <>
                  <p className="text-5xl font-extrabold text-emerald-600 tracking-tight">
                    {formatValuation(latest.valuation_estimate)}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Calculated {formatDate(latest.created_at)} · {latest.methodology}
                  </p>
                </>
              ) : (
                <p className="text-3xl font-bold text-gray-300">No snapshot yet</p>
              )}
            </div>
            <form action="/api/valuation" method="GET">
              <button
                type="submit"
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                Recalculate
              </button>
            </form>
          </div>

          {/* Trend line (sparkline-style) */}
          {trend.length > 0 && (
            <div className="mt-5 pt-5 border-t border-gray-100">
              <p className="text-xs text-gray-400 mb-3">Prior snapshots</p>
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
                      <p className="text-xs text-gray-400">
                        {new Date(snap.created_at).toLocaleDateString('en-ZA', { month: 'short' })}
                      </p>
                    </div>
                  )
                })}
                {latest && (
                  <div className="flex flex-col items-center gap-1">
                    <div
                      className="w-10 rounded-t bg-emerald-600 cursor-default"
                      style={{ height: '60px' }}
                      title={`Latest: ${formatValuation(latest.valuation_estimate)}`}
                    />
                    <p className="text-xs font-semibold text-emerald-600">Now</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </Card>

        {/* 7 Value Drivers */}
        <Card>
          <h3 className="font-semibold text-gray-900 mb-5">7 Value Drivers</h3>
          {drivers ? (
            <div className="space-y-4">
              {(Object.keys(DRIVER_LABELS) as Array<keyof Driver>).map((key) => {
                const score = drivers[key] ?? 0
                const pct = Math.min(Math.max(score, 0), 100)
                const color = DRIVER_COLORS[key]
                return (
                  <div key={key}>
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <span className="text-gray-700 font-medium">{DRIVER_LABELS[key]}</span>
                      <span className="text-gray-500 font-semibold tabular-nums">{pct}%</span>
                    </div>
                    <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${color}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-10 text-gray-400">
              <p className="text-4xl mb-3">📊</p>
              <p className="text-sm">No valuation data yet. Click Recalculate to generate your first snapshot.</p>
            </div>
          )}
        </Card>

        {/* Methodology note */}
        {latest?.methodology && (
          <Card>
            <h3 className="font-semibold text-gray-900 mb-2">Methodology</h3>
            <p className="text-sm text-gray-600">{latest.methodology}</p>
            <p className="text-xs text-gray-400 mt-3">
              Valuations are estimates based on available financial data. Consult a professional valuator for legal or investment purposes.
            </p>
          </Card>
        )}

      </div>
    </div>
  )
}
