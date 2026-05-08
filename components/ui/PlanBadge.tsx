type Plan = 'trial' | 'starter' | 'growth' | 'enterprise' | 'white_label'

const planConfig: Record<Plan, { label: string; bg: string; text: string }> = {
  trial:       { label: 'Trial',       bg: 'rgba(245,158,11,0.15)', text: '#F59E0B' },
  starter:     { label: 'Starter',     bg: 'rgba(99,102,241,0.15)', text: '#818CF8' },
  growth:      { label: 'Growth ⭐',   bg: 'rgba(34,197,94,0.15)',  text: '#22C55E' },
  enterprise:  { label: 'Enterprise',  bg: 'rgba(139,92,246,0.15)', text: '#A78BFA' },
  white_label: { label: 'White Label', bg: 'rgba(201,168,76,0.15)', text: '#C9A84C' },
}

export function PlanBadge({ plan }: { plan: Plan | string }) {
  const cfg = planConfig[plan as Plan] ?? { label: plan, bg: 'var(--surface-2)', text: 'var(--text-muted)' }
  return (
    <span
      className="inline-flex items-center text-xs font-semibold px-2.5 py-0.5 rounded-full"
      style={{ background: cfg.bg, color: cfg.text }}
    >
      {cfg.label}
    </span>
  )
}
