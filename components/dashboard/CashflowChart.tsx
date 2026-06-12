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
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg px-4 py-3 text-sm min-w-[160px]">
      <p className="font-semibold text-gray-700 mb-2">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex justify-between gap-4">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="font-medium text-gray-900">{formatK(p.value)}</span>
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
      <div className="flex items-center justify-center h-48 text-sm text-gray-400">
        No cashflow entries to chart yet.
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={buckets} barGap={2} barCategoryGap="30%">
        <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: '#9CA3AF' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={formatK}
          tick={{ fontSize: 11, fill: '#9CA3AF' }}
          axisLine={false}
          tickLine={false}
          width={52}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: '#F9FAFB' }} />
        <ReferenceLine y={0} stroke="#E5E7EB" />
        <Bar dataKey="income"  name="Income"  fill="#22C55E" radius={[4, 4, 0, 0]} />
        <Bar dataKey="expense" name="Expense" fill="#F87171" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
