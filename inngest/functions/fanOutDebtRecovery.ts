import { inngest } from '@/inngest/client'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const fanOutDebtRecoveryCron = inngest.createFunction(
  { id: 'fan-out-debt-recovery-cron', retries: 0, triggers: [{ cron: '0 8 * * *' }] },
  async ({ step }: any) => {
    const invoices = await step.run('fetch-overdue-invoices', async () => {
      const { data } = await supabaseAdmin
        .from('invoices')
        .select('id, tenant_id, amount, days_overdue')
        .in('status', ['unpaid', 'partial'])
        .gt('days_overdue', 0)
        .order('days_overdue', { ascending: false })
        .limit(500)
      return data ?? []
    })

    if (!invoices.length) return { fanned: 0 }

    await step.run('send-events', async () => {
      await inngest.send(
        invoices.map((inv: any) => ({
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
