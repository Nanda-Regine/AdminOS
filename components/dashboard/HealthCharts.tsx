'use client'

import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

// Same theme-aware chrome as CashflowChart.tsx — translucent grid lines that
// read correctly on the dark navy card and stay subtle in light mode.
function CustomTooltip({ active, payload, label }: {
  active?: boolean
  payload?: { name: string; value: number; color: string }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[var(--surface-1)] border border-[var(--border)] rounded-xl shadow-lg px-4 py-3 text-sm min-w-[140px]">
      {label && <p className="font-semibold text-[var(--text-secondary)] mb-2">{label}</p>}
      {payload.map((p) => (
        <div key={p.name} className="flex justify-between gap-4">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="font-medium text-[var(--text-primary)]">{p.value}</span>
        </div>
      ))}
    </div>
  )
}

export function HealthRadarChart({ data }: { data: { label: string; score: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <RadarChart data={data} outerRadius="72%">
        <PolarGrid stroke="rgba(148,163,184,0.18)" />
        <PolarAngleAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
        <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 9, fill: 'var(--text-dim)' }} axisLine={false} tickCount={5} />
        <Radar name="Score" dataKey="score" stroke="var(--indigo)" fill="var(--indigo)" fillOpacity={0.35} />
        <Tooltip content={<CustomTooltip />} />
      </RadarChart>
    </ResponsiveContainer>
  )
}

export function HealthTrendChart({ data }: { data: { label: string; score: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.18)" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-dim)' }} axisLine={false} tickLine={false} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: 'var(--text-dim)' }} axisLine={false} tickLine={false} width={30} />
        <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(148,163,184,0.25)' }} />
        <Line
          type="monotone"
          dataKey="score"
          name="Overall score"
          stroke="var(--indigo)"
          strokeWidth={2.5}
          dot={{ r: 3, fill: 'var(--indigo)', strokeWidth: 0 }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
