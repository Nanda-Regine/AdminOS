import { supabaseAdmin } from '@/lib/supabase/admin'

/**
 * The single source of truth for a tenant's trial state — read from the
 * `subscriptions` row the auto_create_subscription trigger writes on signup
 * (status='trialing', trial_ends_at = signup + 14 days). Previously the billing
 * page computed this from `tenants.created_at + 14d` and keyed "on trial" off
 * `tenants.plan` (which is 'solo', never 'trial'), so real trial users never saw
 * their trial. This reads the subscription directly.
 *
 * The nightly trial-expiry cron flips lapsed trials to 'past_due', but the state
 * here also derives `expired` straight from trial_ends_at so the banner is correct
 * the instant a trial lapses, before the cron runs.
 */
export interface TrialState {
  /** In an active trial with time left. */
  onTrial:       boolean
  /** Trial has ended (lapsed date, or the cron marked it past_due) and no paid plan. */
  expired:       boolean
  /** Whole days left (0 once lapsed). */
  daysRemaining: number
  trialEndsAt:   Date | null
}

const NO_TRIAL: TrialState = { onTrial: false, expired: false, daysRemaining: 0, trialEndsAt: null }

export async function getTrialState(tenantId: string): Promise<TrialState> {
  if (!tenantId) return NO_TRIAL

  const { data: sub } = await supabaseAdmin
    .from('subscriptions')
    .select('status, trial_ends_at')
    .eq('tenant_id', tenantId)
    .maybeSingle()

  // Only trial-related statuses drive the banner. active/cancelled/suspended → nothing.
  if (!sub || (sub.status !== 'trialing' && sub.status !== 'past_due')) return NO_TRIAL

  const end = sub.trial_ends_at ? new Date(sub.trial_ends_at) : null
  const msLeft = end ? end.getTime() - Date.now() : 0
  const expired = sub.status === 'past_due' || (end !== null && msLeft <= 0)
  const daysRemaining = expired ? 0 : Math.max(0, Math.ceil(msLeft / 86_400_000))

  return { onTrial: !expired, expired, daysRemaining, trialEndsAt: end }
}
