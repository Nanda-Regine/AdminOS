import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { TopBar } from '@/components/dashboard/TopBar'
import { Card } from '@/components/ui/card'
import { redirect } from 'next/navigation'
import { CashflowChart } from '@/components/dashboard/CashflowChart'

export const dynamic = 'force-dynamic'

function formatCurrency(val: number) {
  return `R ${val.toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

type CashflowEntry = {
  id: string
  type: 'income' | 'expense'
  amount: number
  description: string
  category: string
  date: string
  recurring: boolean
}

export default async function CashflowPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const tenantId = user.app_metadata?.tenant_id as string

  const today     = new Date()
  const todayStr  = today.toISOString().slice(0, 10)
  const in30Days  = new Date(today); in30Days.setDate(today.getDate() + 30)
  const in30Str   = in30Days.toISOString().slice(0, 10)
  const in90Days  = new Date(today); in90Days.setDate(today.getDate() + 90)
  const in90Str   = in90Days.toISOString().slice(0, 10)

  const [entriesResult, forecastResult] = await Promise.all([
    supabaseAdmin
      .from('cashflow_entries')
      .select('id, type, amount, description, category, date, recurring')
      .eq('tenant_id', tenantId)
      .gte('date', todayStr)
      .lte('date', in90Str)
      .order('date', { ascending: true }),
    supabaseAdmin
      .from('cashflow_forecasts')
      .select('forecast_data, calculated_at')
      .eq('tenant_id', tenantId)
      .order('calculated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const entries: CashflowEntry[] = (entriesResult.data || []) as CashflowEntry[]
  const forecast = forecastResult.data

  const allInflow  = entries.filter(e => e.type === 'income').reduce((s, e) => s + Number(e.amount), 0)
  const allOutflow = entries.filter(e => e.type === 'expense').reduce((s, e) => s + Number(e.amount), 0)
  const net        = allInflow - allOutflow

  const monthlyBurn = allOutflow / (90 / 30.4)
  const runway      = monthlyBurn > 0 ? net / monthlyBurn : null

  const next30 = entries.filter(e => e.date <= in30Str)
  const out30  = entries.filter(e => e.date > in30Str)

  const runwayColor =
    runway === null ? 'text-gray-400' :
    runway >= 6     ? 'text-emerald-600' :
    runway >= 3     ? 'text-yellow-600'  : 'text-red-600'

  const runwayBarColor =
    runway === null ? 'bg-gray-200' :
    runway >= 6     ? 'bg-emerald-500' :
    runway >= 3     ? 'bg-yellow-400'  : 'bg-red-500'

  return (
    <div>
      <TopBar title="Cashflow" subtitle="90-day forecast · income vs expense" />
      <div className="p-6 space-y-6">

        {/* Summary stat cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Inflow (90d)</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{formatCurrency(allInflow)}</p>
          </Card>
          <Card>
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Outflow (90d)</p>
            <p className="text-2xl font-bold text-red-500 mt-1">{formatCurrency(allOutflow)}</p>
          </Card>
          <Card>
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Net Position</p>
            <p className={`text-2xl font-bold mt-1 ${net >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
              {net >= 0 ? '' : '−'}{formatCurrency(Math.abs(net))}
            </p>
          </Card>
        </div>

        {/* Chart */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-gray-900">90-Day Forecast</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Grouped in 10-day bands ·{' '}
                <span className="text-emerald-500 font-medium">green = income</span>
                {' '}·{' '}
                <span className="text-red-400 font-medium">red = expense</span>
              </p>
            </div>
            {forecast && (
              <p className="text-xs text-gray-400 hidden sm:block">
                Last recalculated{' '}
                {new Date(forecast.calculated_at).toLocaleDateString('en-ZA', {
                  day: 'numeric', month: 'short',
                })}
              </p>
            )}
          </div>
          <CashflowChart entries={entries} />
        </Card>

        {/* Runway */}
        <Card>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold text-gray-900">Cash Runway</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Based on 90-day burn rate. Green = 6+ months, yellow = 3–6, red = &lt;3.
              </p>
            </div>
            <div className="text-right shrink-0">
              {runway !== null ? (
                <>
                  <p className={`text-4xl font-bold ${runwayColor}`}>{Math.max(0, Math.floor(runway))}</p>
                  <p className="text-xs text-gray-400">months</p>
                </>
              ) : (
                <p className="text-sm text-gray-400">Insufficient data</p>
              )}
            </div>
          </div>
          {runway !== null && (
            <div className="mt-4 h-2.5 rounded-full bg-gray-100 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${runwayBarColor}`}
                style={{ width: `${Math.min((Math.floor(runway) / 12) * 100, 100)}%` }}
              />
            </div>
          )}
        </Card>

        {/* Next 30 days */}
        <Card padding="none">
          <div className="p-5 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Next 30 Days</h3>
            <span className="text-xs text-gray-400">{next30.length} entries</span>
          </div>
          <div className="divide-y divide-gray-50">
            {next30.length === 0 && (
              <p className="px-5 py-10 text-center text-sm text-gray-400">
                No entries scheduled in the next 30 days.
              </p>
            )}
            {next30.map(entry => (
              <div key={entry.id} className="flex items-center gap-4 px-5 py-3">
                <div className={`w-1 h-9 rounded-full shrink-0 ${entry.type === 'income' ? 'bg-emerald-400' : 'bg-red-400'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{entry.description}</p>
                  <p className="text-xs text-gray-400">
                    {entry.category}
                    {entry.recurring && <span className="ml-2 text-indigo-400">· recurring</span>}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-sm font-semibold ${entry.type === 'income' ? 'text-emerald-600' : 'text-red-500'}`}>
                    {entry.type === 'income' ? '+' : '−'}{formatCurrency(Number(entry.amount))}
                  </p>
                  <p className="text-xs text-gray-400">
                    {new Date(entry.date).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* 31–90 days */}
        {out30.length > 0 && (
          <Card padding="none">
            <div className="p-5 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">31–90 Day Outlook</h3>
            </div>
            <div className="divide-y divide-gray-50">
              {out30.map(entry => (
                <div key={entry.id} className="flex items-center gap-4 px-5 py-3">
                  <div className={`w-1 h-9 rounded-full shrink-0 ${entry.type === 'income' ? 'bg-emerald-200' : 'bg-red-200'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700 truncate">{entry.description}</p>
                    <p className="text-xs text-gray-400">
                      {entry.category}
                      {entry.recurring && ' · recurring'}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-medium ${entry.type === 'income' ? 'text-emerald-500' : 'text-red-400'}`}>
                      {entry.type === 'income' ? '+' : '−'}{formatCurrency(Number(entry.amount))}
                    </p>
                    <p className="text-xs text-gray-400">
                      {new Date(entry.date).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {entries.length === 0 && (
          <div className="text-center py-16">
            <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-3 text-2xl">
              📊
            </div>
            <p className="text-sm font-medium text-gray-500">No cashflow entries yet</p>
            <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto">
              Add income and expense entries to build your 90-day forecast and see your runway.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
