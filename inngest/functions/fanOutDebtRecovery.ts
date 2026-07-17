import { inngest } from '@/inngest/client'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const fanOutDebtRecoveryCron = inngest.createFunction(
  { id: 'fan-out-debt-recovery-cron', retries: 0, triggers: [{ cron: '0 8 * * *' }] },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async ({ step }: any) => {
    const invoices = await step.run('fetch-overdue-invoices', async () => {
      const { data } = await supabaseAdmin
        .from('invoices')
        .select('id, tenant_id, amount, days_overdue')
        .in('status', ['unpaid', 'partial'])
        .gt('days_overdue', 0)
        // Only invoices on the automatic track. Anything the owner has paused
        // (debt disputed or under arrangement), flagged for their own review
        // (tier 4+), or already approved to send by hand must NOT be swept back
        // into the auto-sender — otherwise a paused invoice keeps dunning the
        // customer, which defeats the pause. Null recovery_status == 'auto'
        // (pre-migration default), so it is explicitly included.
        .or('recovery_status.is.null,recovery_status.eq.auto')
        .order('days_overdue', { ascending: false })
        .limit(500)
      return data ?? []
    })

    if (!invoices.length) return { fanned: 0 }

    await step.run('send-events', async () => {
      const overdue = invoices as Array<{ id: string; tenant_id: string; amount: number; days_overdue: number }>
      await inngest.send(
        overdue.map((inv) => ({
          name: 'adminos/invoice.overdue' as const,
          data: {
            invoice_id: inv.id,
            tenant_id: inv.tenant_id,
            amount: inv.amount,
            days_overdue: inv.days_overdue,
          },
        }))
      )
    })

    return { fanned: invoices.length }
  }
)
