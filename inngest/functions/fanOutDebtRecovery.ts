import { inngest } from '@/inngest/client'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { daysOverdue, todayDateString } from '@/lib/debt/overdue'

export const fanOutDebtRecoveryCron = inngest.createFunction(
  { id: 'fan-out-debt-recovery-cron', retries: 0, triggers: [{ cron: '0 8 * * *' }] },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async ({ step }: any) => {
    const invoices = await step.run('fetch-overdue-invoices', async () => {
      // Filter on due_date, not days_overdue: the latter is a drifted column that
      // may not exist in prod (see lib/debt/overdue). Past-due == due_date before
      // today; we compute the exact day count below.
      const { data } = await supabaseAdmin
        .from('invoices')
        .select('id, tenant_id, amount, due_date')
        .in('status', ['unpaid', 'partial'])
        .lt('due_date', todayDateString())
        // Only invoices on the automatic track. Anything the owner has paused
        // (debt disputed or under arrangement), flagged for their own review
        // (tier 4+), or already approved to send by hand must NOT be swept back
        // into the auto-sender — otherwise a paused invoice keeps dunning the
        // customer, which defeats the pause. Null recovery_status == 'auto'
        // (pre-migration default), so it is explicitly included.
        .or('recovery_status.is.null,recovery_status.eq.auto')
        .order('due_date', { ascending: true })
        .limit(500)

      const rows = (data ?? []) as Array<{ id: string; tenant_id: string; amount: number; due_date: string }>
      return rows
        .map((inv) => ({
          id: inv.id,
          tenant_id: inv.tenant_id,
          amount: inv.amount,
          days_overdue: daysOverdue(inv.due_date),
        }))
        .filter((inv) => inv.days_overdue > 0)
    })

    if (!invoices.length) return { fanned: 0 }

    await step.run('send-events', async () => {
      await inngest.send(
        invoices.map((inv) => ({
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
