import { inngest } from '@/inngest/client'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { purgeDeletedAccount } from '@/lib/account/deletion'

/**
 * Daily (02:30) — anonymise logins whose 30-day deletion window has passed
 * (lib/account/deletion.ts). One step per account, so one failure retries
 * alone and a re-run never repeats finished work. Capped at 200 per run;
 * anything beyond waits a day rather than nearing Inngest's step limit.
 */
export const accountDeletionPurgeCron = inngest.createFunction(
  { id: 'account-deletion-purge', retries: 2, triggers: [{ cron: '30 2 * * *' }] },
  async ({ step }: any) => {
    const due = await step.run('find-due', async () => {
      const { data, error } = await supabaseAdmin
        .from('account_deletion_requests')
        .select('id, user_id')
        .eq('status', 'pending')
        .lt('purge_after', new Date().toISOString())
        .order('purge_after')
        .limit(200)
      if (error) throw new Error(error.message)
      return data ?? []
    })

    for (const r of due as { id: string; user_id: string }[]) {
      await step.run(`purge-${r.id}`, () => purgeDeletedAccount(r.id, r.user_id))
    }
    return { purged: due.length }
  }
)
