import { inngest } from '@/inngest/client'
import { supabaseAdmin } from '@/lib/supabase/admin'

// Runs every hour — syncs social media messages and comments for connected accounts
// TODO: Implement actual Facebook/Instagram Graph API calls
export const socialSyncFunction = inngest.createFunction(
  { id: 'social-sync-hourly', retries: 1, triggers: [{ cron: '0 * * * *' }] },
  async ({ step }: any) => {
    // Step 1: Fetch all active social accounts
    // social_accounts has no page_id/last_synced_at columns — page_id is
    // account_id, and there's no sync-tracking column at all (not under any
    // name). This select always errored, so the sync never actually found
    // any accounts to iterate.
    const accounts = await step.run('get-active-social-accounts', async () => {
      const { data } = await supabaseAdmin
        .from('social_accounts')
        .select('id, tenant_id, platform, access_token, account_id')
        .not('access_token', 'is', null)

      return data ?? []
    })

    if (accounts.length === 0) return { synced: 0 }

    let synced = 0
    let failed = 0
    const errors: string[] = []

    for (const account of accounts) {
      // eslint-disable-next-line no-await-in-loop
      const result = await step.run(`sync-account-${account.id}`, async () => {
        try {
          // TODO: Implement platform-specific API calls
          // Facebook/Instagram: GET /{page-id}/conversations via Graph API
          // Twitter/X: GET /2/users/{id}/mentions via v2 API
          //
          // Example structure for when implemented:
          // if (account.platform === 'facebook' || account.platform === 'instagram') {
          //   const messages = await fetchFacebookMessages(account.account_id, account.access_token)
          //   await upsertIncomingMessages(account.tenant_id, account.id, messages)
          // }

          // social_accounts has no last_synced_at column (or any sync-
          // tracking column under another name) — nothing to update here
          // until one exists via migration. This stub previously "recorded"
          // a sync that always silently failed to write.

          return {
            status: 'ok',
            platform: account.platform,
            note: 'stub — API calls not yet implemented',
          }
        } catch (err) {
          return { status: 'error', error: String(err) }
        }
      })

      if (result.status === 'ok') synced++
      else {
        failed++
        errors.push(`account ${account.id} (${account.platform}): ${result.error}`)
      }
    }

    return { total: accounts.length, synced, failed, errors }
  }
)
