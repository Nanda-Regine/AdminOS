'use client'

import { useEffect, useRef, useState } from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface StatCardProps {
  label: string
  value: number | string
  change?: string
  changeType?: 'up' | 'down' | 'neutral'
  icon?: React.ReactNode
  sparkline?: number[]
  prefix?: string
  suffix?: string
  accentColor?: string
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null
  const w = 80
  const h = 28
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w
    const y = h - ((v - min) / range) * h
    return `${x},${y}`
  }).join(' ')

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none" className="overflow-visible">
      <defs>
        <linearGradient id={`sg-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function AnimatedNumber({ target, prefix = '', suffix = '' }: {
  target: number; prefix?: string; suffix?: string
}) {
  const [display, setDisplay] = useState(0)
  const rafRef = useRef<number | null>(null)
  const startRef = useRef<number | null>(null)

  useEffect(() => {
    const duration = 900
    const start = 0
    const animate = (now: number) => {
      if (!startRef.current) startRef.current = now
      const elapsed = now - startRef.current
      const progress = Math.min(elapsed / duration, 1)
      const ease = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(start + (target - start) * ease))
      if (progress < 1) rafRef.current = requestAnimationFrame(animate)
    }
    rafRef.current = requestAnimationFrame(animate)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [target])

  return <>{prefix}{display.toLocaleString()}{suffix}</>
}

export function StatCard({
  label, value, change, changeType = 'neutral', icon,
  sparkline, prefix = '', suffix = '', accentColor = 'var(--indigo)',
}: StatCardProps) {
  const isNumeric = typeof value === 'number'

  const trendIcon = changeType === 'up'
    ? <TrendingUp className="w-3 h-3" />
    : changeType === 'down'
    ? <TrendingDown className="w-3 h-3" />
    : <Minus className="w-3 h-3" />

  const trendStyle = changeType === 'up'
    ? { background: 'rgba(34,197,94,0.12)', color: '#22C55E' }
    : changeType === 'down'
    ? { background: 'rgba(239,68,68,0.12)', color: '#EF4444' }
    : { background: 'var(--surface-2)', color: 'var(--text-muted)' }

  return (
    <div
      className="glass rounded-2xl p-5 relative overflow-hidden transition-all hover:border-white/10"
      style={{ borderColor: 'var(--border)' }}
    >
      {/* Background accent glow */}
      <div
        className="absolute -top-6 -right-6 w-24 h-24 rounded-full blur-2xl opacity-10 pointer-events-none"
        style={{ background: accentColor }}
      />

      <div className="relative flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider truncate" style={{ color: 'var(--text-muted)' }}>
            {label}
          </p>
          <p className="text-2xl font-bold mt-1.5 tabular-nums" style={{ color: 'var(--text-primary)' }}>
            {isNumeric
              ? <AnimatedNumber target={value as number} prefix={prefix} suffix={suffix} />
              : <>{prefix}{value}{suffix}</>
            }
          </p>
          {change && (
            <span
              className="inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-md mt-2"
              style={trendStyle}
            >
              {trendIcon}
              {change}
            </span>
          )}
        </div>

        <div className="flex flex-col items-end gap-2 shrink-0">
          {icon && (
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'var(--indigo-muted)' }}
            >
              {icon}
            </div>
          )}
          {sparkline && <Sparkline data={sparkline} color={accentColor} />}
        </div>
      </div>
    </div>
  )
}
