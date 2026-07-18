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

  // Cashflow is DERIVED from real ledgers (there is no cashflow_entries table):
  //   inflow  = outstanding on unpaid/partial invoices, positioned at due_date
  //   outflow = unpaid (non-rejected) expenses
  // Overdue receivables and already-incurred payables are money still moving now,
  // so anything dated on/before today is clamped to today to sit at the front of
  // the forward window (we have no real future payment schedule for them).
  const [invoiceResult, expenseResult, forecastResult] = await Promise.all([
    supabaseAdmin
      .from('invoices')
      .select('id, contact_name, amount, amount_paid, due_date, status')
      .eq('tenant_id', tenantId)
      .neq('status', 'paid'),
    supabaseAdmin
      .from('expenses')
      .select('id, amount, category, description, status, submitted_at, approved_at, paid_at')
      .eq('tenant_id', tenantId)
      .is('paid_at', null)
      .neq('status', 'rejected'),
    supabaseAdmin
      .from('cashflow_forecasts')
      .select('generated_at')
      .eq('tenant_id', tenantId)
      .order('generated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const clampDate = (d: string | null | undefined) => {
    const day = d ? d.slice(0, 10) : todayStr
    return day >= todayStr ? day : todayStr
  }

  const invoiceEntries: CashflowEntry[] = (invoiceResult.data || [])
    .map((inv) => ({ inv, outstanding: Number(inv.amount || 0) - Number(inv.amount_paid || 0) }))
    .filter(({ outstanding }) => outstanding > 0.005)
    .map(({ inv, outstanding }) => ({
      id: `inv-${inv.id}`,
      type: 'income' as const,
      amount: outstanding,
      description: inv.contact_name || 'Invoice',
      category: 'Receivable',
      date: clampDate(inv.due_date),
      recurring: false,
    }))

  const expenseEntries: CashflowEntry[] = (expenseResult.data || []).map((e) => ({
    id: `exp-${e.id}`,
    type: 'expense' as const,
    amount: Number(e.amount || 0),
    description: e.description || e.category || 'Expense',
    category: e.category || 'Expense',
    date: clampDate(e.approved_at || e.submitted_at),
    recurring: false,
  }))

  const entries: CashflowEntry[] = [...invoiceEntries, ...expenseEntries]
    .filter((e) => e.date >= todayStr && e.date <= in90Str)
    .sort((a, b) => a.date.localeCompare(b.date))

  const forecast = forecastResult.data

  const allInflow  = entries.filter(e => e.type === 'income').reduce((s, e) => s + Number(e.amount), 0)
  const allOutflow = entries.filter(e => e.type === 'expense').reduce((s, e) => s + Number(e.amount), 0)
  const net        = allInflow - allOutflow

  const monthlyBurn = allOutflow / (90 / 30.4)
  const runway      = monthlyBurn > 0 ? net / monthlyBurn : null

  const next30 = entries.filter(e => e.date <= in30Str)
  const out30  = entries.filter(e => e.date > in30Str)

  const runwayColor =
    runway === null ? 'text-[var(--text-dim)]' :
    runway >= 6     ? 'text-emerald-600' :
    runway >= 3     ? 'text-yellow-600'  : 'text-red-600'

  const runwayBarColor =
    runway === null ? 'bg-[var(--surface-2)]' :
    runway >= 6     ? 'bg-emerald-500' :
    runway >= 3     ? 'bg-yellow-400'  : 'bg-red-500'

  return (
    <div>
      <TopBar title="Cashflow" subtitle="90-day forecast · income vs expense" />
      <div className="p-6 space-y-6">

        {/* Summary stat cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <p className="text-xs text-[var(--text-dim)] uppercase tracking-wide font-medium">Inflow (90d)</p>
            <p className="text-2xl font-bold text-emerald-400 mt-1">{formatCurrency(allInflow)}</p>
          </Card>
          <Card>
            <p className="text-xs text-[var(--text-dim)] uppercase tracking-wide font-medium">Outflow (90d)</p>
            <p className="text-2xl font-bold text-red-400 mt-1">{formatCurrency(allOutflow)}</p>
          </Card>
          <Card>
            <p className="text-xs text-[var(--text-dim)] uppercase tracking-wide font-medium">Net Position</p>
            <p className={`text-2xl font-bold mt-1 ${net >= 0 ? 'text-[var(--text-primary)]' : 'text-red-400'}`}>
              {net >= 0 ? '' : '−'}{formatCurrency(Math.abs(net))}
            </p>
          </Card>
        </div>

        {entries.length > 0 ? (
        <>
        {/* Chart */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-[var(--text-primary)]">90-Day Forecast</h3>
              <p className="text-xs text-[var(--text-dim)] mt-0.5">
                Grouped in 10-day bands ·{' '}
                <span className="text-emerald-500 font-medium">green = income</span>
                {' '}·{' '}
                <span className="text-red-400 font-medium">red = expense</span>
              </p>
            </div>
            {forecast && (
              <p className="text-xs text-[var(--text-dim)] hidden sm:block">
                Last recalculated{' '}
                {new Date(forecast.generated_at).toLocaleDateString('en-ZA', {
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
              <h3 className="font-semibold text-[var(--text-primary)]">Cash Runway</h3>
              <p className="text-xs text-[var(--text-dim)] mt-0.5">
                Based on 90-day burn rate. Green = 6+ months, yellow = 3–6, red = &lt;3.
              </p>
            </div>
            <div className="text-right shrink-0">
              {runway !== null ? (
                <>
                  <p className={`text-4xl font-bold ${runwayColor}`}>{Math.max(0, Math.floor(runway))}</p>
                  <p className="text-xs text-[var(--text-dim)]">months</p>
                </>
              ) : (
                <p className="text-sm text-[var(--text-dim)]">Insufficient data</p>
              )}
            </div>
          </div>
          {runway !== null && (
            <div className="mt-4 h-2.5 rounded-full bg-[var(--surface-2)] overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${runwayBarColor}`}
                style={{ width: `${Math.min((Math.floor(runway) / 12) * 100, 100)}%` }}
              />
            </div>
          )}
        </Card>

        {/* Next 30 days */}
        <Card padding="none">
          <div className="p-5 border-b border-[var(--border)] flex items-center justify-between">
            <h3 className="font-semibold text-[var(--text-primary)]">Next 30 Days</h3>
            <span className="text-xs text-[var(--text-dim)]">{next30.length} entries</span>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {next30.length === 0 && (
              <p className="px-5 py-10 text-center text-sm text-[var(--text-dim)]">
                No entries scheduled in the next 30 days.
              </p>
            )}
            {next30.map(entry => (
              <div key={entry.id} className="flex items-center gap-4 px-5 py-3">
                <div className={`w-1 h-9 rounded-full shrink-0 ${entry.type === 'income' ? 'bg-emerald-400' : 'bg-red-400'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--text-primary)] truncate">{entry.description}</p>
                  <p className="text-xs text-[var(--text-dim)]">
                    {entry.category}
                    {entry.recurring && <span className="ml-2 text-indigo-400">· recurring</span>}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-sm font-semibold ${entry.type === 'income' ? 'text-emerald-600' : 'text-red-500'}`}>
                    {entry.type === 'income' ? '+' : '−'}{formatCurrency(Number(entry.amount))}
                  </p>
                  <p className="text-xs text-[var(--text-dim)]">
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
            <div className="p-5 border-b border-[var(--border)]">
              <h3 className="font-semibold text-[var(--text-primary)]">31–90 Day Outlook</h3>
            </div>
            <div className="divide-y divide-[var(--border)]">
              {out30.map(entry => (
                <div key={entry.id} className="flex items-center gap-4 px-5 py-3">
                  <div className={`w-1 h-9 rounded-full shrink-0 ${entry.type === 'income' ? 'bg-emerald-200' : 'bg-red-200'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[var(--text-secondary)] truncate">{entry.description}</p>
                    <p className="text-xs text-[var(--text-dim)]">
                      {entry.category}
                      {entry.recurring && ' · recurring'}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-medium ${entry.type === 'income' ? 'text-emerald-500' : 'text-red-400'}`}>
                      {entry.type === 'income' ? '+' : '−'}{formatCurrency(Number(entry.amount))}
                    </p>
                    <p className="text-xs text-[var(--text-dim)]">
                      {new Date(entry.date).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
        </>
        ) : (
          <div className="text-center py-16">
            <div className="w-12 h-12 rounded-2xl bg-[var(--surface-2)] flex items-center justify-center mx-auto mb-3 text-2xl">
              📊
            </div>
            <p className="text-sm font-medium text-[var(--text-muted)]">Nothing to forecast yet</p>
            <p className="text-xs text-[var(--text-dim)] mt-1 max-w-xs mx-auto">
              Cashflow is projected from your unpaid invoices (money in) and outstanding expenses
              (money out). Add invoices and expense claims to build your 90-day forecast and runway.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
