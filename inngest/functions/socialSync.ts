import { inngest } from '@/inngest/client'
import { supabaseAdmin } from '@/lib/supabase/admin'

// Runs every hour — syncs social media messages and comments for connected accounts
// TODO: Implement actual Facebook/Instagram Graph API calls
export const socialSyncFunction = inngest.createFunction(
  { id: 'social-sync-hourly', retries: 1, triggers: [{ cron: '0 * * * *' }] },
  async ({ step }: any) => {
    // Step 1: Fetch all active social accounts
    const accounts = await step.run('get-active-social-accounts', async () => {
      const { data } = await supabaseAdmin
        .from('social_accounts')
        .select('id, tenant_id, platform, access_token, page_id, last_synced_at')
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
          //   const messages = await fetchFacebookMessages(account.page_id, account.access_token)
          //   await upsertIncomingMessages(account.tenant_id, account.id, messages)
          // }

          const now = new Date().toISOString()

          // Update last_synced_at to record that sync ran
          const { error } = await supabaseAdmin
            .from('social_accounts')
            .update({ last_synced_at: now })
            .eq('id', account.id)

          if (error) throw new Error(`Update failed: ${error.message}`)

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
