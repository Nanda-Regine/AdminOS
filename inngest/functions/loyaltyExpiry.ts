import { inngest } from '@/inngest/client'
import { supabaseAdmin } from '@/lib/supabase/admin'

// Runs on Dec 31 at 11pm — expires all outstanding loyalty points at year end
export const loyaltyExpiryFunction = inngest.createFunction(
  { id: 'loyalty-expiry-year-end', retries: 2 },
  { cron: '0 23 31 12 *' },
  async ({ step }) => {
    const year = new Date().getFullYear()

    // Step 1: Fetch all accounts with a positive points balance
    const accounts = await step.run('get-accounts-with-points', async () => {
      const { data } = await supabaseAdmin
        .from('loyalty_accounts')
        .select('id, tenant_id, contact_id, points_balance, total_earned, total_redeemed')
        .gt('points_balance', 0)

      return data ?? []
    })

    if (accounts.length === 0) return { year, expired: 0 }

    let expired = 0
    let failed = 0
    const errors: string[] = []

    for (const account of accounts) {
      // eslint-disable-next-line no-await-in-loop
      const result = await step.run(`expire-account-${account.id}`, async () => {
        const pointsToExpire = account.points_balance as number
        const now = new Date().toISOString()

        // Record the expiry transaction
        const { error: txError } = await supabaseAdmin
          .from('loyalty_transactions')
          .insert({
            loyalty_account_id: account.id,
            tenant_id: account.tenant_id,
            contact_id: account.contact_id,
            type: 'expiry',
            points: -pointsToExpire,
            description: `Year-end points expiry (${year})`,
            created_at: now,
          })

        if (txError) throw new Error(`Transaction insert failed: ${txError.message}`)

        // Zero out the balance
        const { error: updateError } = await supabaseAdmin
          .from('loyalty_accounts')
          .update({ points_balance: 0, updated_at: now })
          .eq('id', account.id)

        if (updateError) throw new Error(`Balance update failed: ${updateError.message}`)

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
        errors.push(`account ${account.id}: ${result.error}`)
      }
    }

    return { year, total_accounts: accounts.length, expired, failed, errors }
  }
)
