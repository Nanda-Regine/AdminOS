import { inngest } from '@/inngest/client'
import { supabaseAdmin } from '@/lib/supabase/admin'

/**
 * Nightly (03:00) — flip lapsed trials to 'past_due'. The trial banner already
 * derives "expired" from trial_ends_at the instant a trial lapses, so this is
 * about keeping the data honest and giving downstream billing logic a clean
 * status to act on. Idempotent: only touches still-'trialing' rows whose
 * trial_ends_at is in the past. ('expired' isn't a valid subscription_status;
 * the enum's closest lapsed state is 'past_due'.)
 */
export const trialExpiryCron = inngest.createFunction(
  { id: 'trial-expiry-cron', retries: 0, triggers: [{ cron: '0 3 * * *' }] },
  async ({ step }: any) => {
    const expired = await step.run('expire-lapsed-trials', async () => {
      const { data, error } = await supabaseAdmin
        .from('subscriptions')
        .update({ status: 'past_due' })
        .eq('status', 'trialing')
        .lt('trial_ends_at', new Date().toISOString())
        .select('tenant_id')
      if (error) throw new Error(error.message)
      return data?.length ?? 0
    })

    return { expired }
  }
)
