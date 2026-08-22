import { inngest } from '@/inngest/client'
import { supabaseAdmin } from '@/lib/supabase/admin'

// Runs on Dec 31 at 11pm — expires all outstanding loyalty points at year end
export const loyaltyExpiryFunction = inngest.createFunction(
  { id: 'loyalty-expiry-year-end', retries: 2, triggers: [{ cron: '0 23 31 12 *' }] },
  async ({ step }: any) => {
    const year = new Date().getFullYear()

    // There's no loyalty_accounts/loyalty_transactions table — loyalty is a
    // single ledger table (loyalty_points) where each row carries the
    // running balance AT THAT ENTRY, not a separate persistent-balance
    // account row. "Current balance" per contact+programme is the most
    // recent entry's `balance`. Fetch the whole ledger and reduce to the
    // latest row per (tenant_id, contact_id, programme_id) client-side —
    // Supabase's JS client has no DISTINCT ON.
    const accounts = await step.run('get-accounts-with-points', async () => {
      const { data } = await supabaseAdmin
        .from('loyalty_points')
        .select('tenant_id, contact_id, programme_id, balance, created_at')
        .order('created_at', { ascending: true })

      const latestByGroup = new Map<string, { tenant_id: string; contact_id: string; programme_id: string; balance: number }>()
      for (const row of data ?? []) {
        const key = `${row.tenant_id}:${row.contact_id}:${row.programme_id}`
        latestByGroup.set(key, row) // ascending order means the last write per key wins
      }

      return [...latestByGroup.values()].filter((r) => Number(r.balance) > 0)
    })

    if (accounts.length === 0) return { year, expired: 0 }

    let expired = 0
    let failed = 0
    const errors: string[] = []

    for (const account of accounts) {
      const stepKey = `${account.tenant_id}-${account.contact_id}-${account.programme_id}`
      // eslint-disable-next-line no-await-in-loop
      const result = await step.run(`expire-account-${stepKey}`, async () => {
        const pointsToExpire = Number(account.balance)
        const now = new Date().toISOString()

        // Record the expiry as a new ledger entry that zeroes the balance —
        // there's no separate account row to update.
        const { error: txError } = await supabaseAdmin
          .from('loyalty_points')
          .insert({
            tenant_id: account.tenant_id,
            contact_id: account.contact_id,
            programme_id: account.programme_id,
            transaction_type: 'expiry',
            points: -pointsToExpire,
            balance: 0,
            notes: `Year-end points expiry (${year})`,
            created_at: now,
          })

        if (txError) throw new Error(`Transaction insert failed: ${txError.message}`)

        // Send notification to tenant
        const { error: notifError } = await supabaseAdmin
          .from('notifications')
          .insert({
            tenant_id: account.tenant_id,
            user_id: null,
            type: 'loyalty_expiry',
            title: 'Loyalty Points Expired',
            body: `${pointsToExpire.toLocaleString()} loyalty points for contact ${account.contact_id} expired at year end (${year}).`,
            read: false,
            created_at: now,
          })

        if (notifError) {
          // Non-fatal — log but don't throw
          console.error('Notification insert failed:', notifError.message)
        }

        return { status: 'ok', points_expired: pointsToExpire }
      })

      if (result.status === 'ok') expired++
      else {
        failed++
        errors.push(`account ${stepKey}: ${result.error}`)
      }
    }

    return { year, total_accounts: accounts.length, expired, failed, errors }
  }
)
