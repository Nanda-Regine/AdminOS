import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getTrialState } from '@/lib/billing/trial'

/**
 * A slim, non-blocking trial bar shown at the top of the dashboard: counts down
 * the days left, and after the trial lapses persists an "ended — upgrade" nudge
 * (never locks the app). Renders nothing for paid tenants. Self-contained — reads
 * the current user itself, so the layout just drops <TrialBanner /> in.
 */
export async function TrialBanner() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const tenantId = user?.app_metadata?.tenant_id as string | undefined
  if (!tenantId) return null

  const t = await getTrialState(tenantId)
  if (!t.onTrial && !t.expired) return null

  // Explicit rgba per state (avoids color-mix — safe on older mobile browsers).
  const tone = t.expired
    ? { solid: '#EF4444', bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.35)' }
    : t.daysRemaining <= 3
      ? { solid: '#F59E0B', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.35)' }
      : { solid: '#6366F1', bg: 'rgba(99,102,241,0.12)', border: 'rgba(99,102,241,0.35)' }

  const message = t.expired
    ? 'Your free trial has ended — upgrade to keep AdminOS running.'
    : t.daysRemaining <= 1
      ? 'Last day of your free trial — upgrade to keep everything running.'
      : `${t.daysRemaining} days left in your free trial.`

  return (
    <div
      className="flex items-center justify-center gap-3 px-4 py-2 text-sm flex-wrap"
      role="status"
      style={{ background: tone.bg, borderBottom: `1px solid ${tone.border}`, color: 'var(--text-secondary)' }}
    >
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: tone.solid }} />
      <span style={{ color: 'var(--text-primary)' }}>{message}</span>
      <Link
        href="/dashboard/settings/billing"
        className="font-semibold px-3 py-1 rounded-lg text-white hover:opacity-90 transition-opacity"
        style={{ background: tone.solid }}
      >
        {t.expired ? 'Upgrade now' : 'Choose a plan'}
      </Link>
    </div>
  )
}
