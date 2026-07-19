'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from 'recharts'

interface CashflowEntry {
  type: 'income' | 'expense'
  amount: number
  date: string
  description: string
}

interface ChartBucket {
  label: string
  income: number
  expense: number
  net: number
}

function formatK(val: number) {
  if (Math.abs(val) >= 1_000_000) return `R${(val / 1_000_000).toFixed(1)}M`
  if (Math.abs(val) >= 1_000) return `R${(val / 1_000).toFixed(0)}k`
  return `R${val.toFixed(0)}`
}

function CustomTooltip({ active, payload, label }: {
  active?: boolean
  payload?: { name: string; value: number; color: string }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[var(--surface-1)] border border-[var(--border)] rounded-xl shadow-lg px-4 py-3 text-sm min-w-[160px]">
      <p className="font-semibold text-[var(--text-secondary)] mb-2">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex justify-between gap-4">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="font-medium text-[var(--text-primary)]">{formatK(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

export function CashflowChart({ entries }: { entries: CashflowEntry[] }) {
  // Bucket entries into ~10-day bands across 90 days
  const today = new Date()

  const buckets: ChartBucket[] = Array.from({ length: 9 }, (_, i) => {
    const start = new Date(today)
    start.setDate(today.getDate() + i * 10)
    const end = new Date(today)
    end.setDate(today.getDate() + (i + 1) * 10 - 1)

    const startStr = start.toISOString().slice(0, 10)
    const endStr   = end.toISOString().slice(0, 10)

    const inBucket = entries.filter(e => e.date >= startStr && e.date <= endStr)
    const income  = inBucket.filter(e => e.type === 'income').reduce((s, e) => s + Number(e.amount), 0)
    const expense = inBucket.filter(e => e.type === 'expense').reduce((s, e) => s + Number(e.amount), 0)

    const label = start.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })
    return { label, income, expense, net: income - expense }
  })

  const hasData = buckets.some(b => b.income > 0 || b.expense > 0)

  if (!hasData) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-[var(--text-dim)]">
        No cashflow entries to chart yet.
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={buckets} barGap={2} barCategoryGap="30%" margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        {/* Theme-aware chrome: translucent white reads correctly on the dark navy
            card and stays subtle in light mode. */}
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.18)" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: 'var(--text-dim)' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={formatK}
          tick={{ fontSize: 11, fill: 'var(--text-dim)' }}
          axisLine={false}
          tickLine={false}
          width={52}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(148,163,184,0.12)' }} />
        <ReferenceLine y={0} stroke="rgba(148,163,184,0.35)" />
        <Legend wrapperStyle={{ fontSize: 11, color: 'var(--text-muted)' }} iconType="circle" iconSize={8} />
        <Bar dataKey="income"  name="Income"  fill="#34D399" radius={[4, 4, 0, 0]} />
        <Bar dataKey="expense" name="Expense" fill="#F87171" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
