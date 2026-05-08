interface LiveBadgeProps {
  label?: string
  color?: 'green' | 'indigo' | 'amber' | 'red'
}

const colorMap = {
  green:  { bg: 'rgba(34,197,94,0.12)',  text: '#22C55E', dot: '#22C55E' },
  indigo: { bg: 'rgba(99,102,241,0.15)', text: '#818CF8', dot: '#818CF8' },
  amber:  { bg: 'rgba(245,158,11,0.12)', text: '#F59E0B', dot: '#F59E0B' },
  red:    { bg: 'rgba(239,68,68,0.12)',  text: '#EF4444', dot: '#EF4444' },
}

export function LiveBadge({ label = 'Live', color = 'green' }: LiveBadgeProps) {
  const c = colorMap[color]
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full"
      style={{ background: c.bg, color: c.text }}
    >
      <span className="live-dot" style={{ background: c.dot }} />
      {label}
    </span>
  )
}
