import { inngest } from '@/inngest/client'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { daysOverdue, todayDateString } from '@/lib/debt/overdue'
import { fetchAll } from '@/lib/supabase/fetchAll'
import { OPEN_INVOICE_STATUSES } from '@/lib/invoices/status'

const SEND_CHUNK = 500

export const fanOutDebtRecoveryCron = inngest.createFunction(
  { id: 'fan-out-debt-recovery-cron', retries: 0, triggers: [{ cron: '0 8 * * *' }] },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async ({ step }: any) => {
    const invoices = await step.run('fetch-overdue-invoices', async () => {
      // Filter on due_date, not days_overdue: that column is only recomputed by
      // a trigger on write, so it goes stale. Past-due == due_date before today.
      //
      // Statuses: every open invoice (lib/invoices/status). This used to be
      // ['unpaid','partial'] — but the app creates invoices as 'sent', so
      // invoices raised in AdminOS were never chased. It was also capped at 500
      // rows across ALL tenants; it now pages through every one.
      const rows = await fetchAll<{ id: string; tenant_id: string; amount: number; amount_paid: number; due_date: string }>(
        (from, to) => supabaseAdmin
          .from('invoices')
          .select('id, tenant_id, amount, amount_paid, due_date')
          .in('status', [...OPEN_INVOICE_STATUSES])
          .lt('due_date', todayDateString())
          .is('deleted_at', null)
          // Only invoices on the automatic track. Anything the owner has paused
          // (debt disputed or under arrangement), flagged for their own review
          // (tier 4+), or already approved to send by hand must NOT be swept back
          // into the auto-sender. Null recovery_status == 'auto' (pre-migration
          // default), so it is explicitly included.
          .or('recovery_status.is.null,recovery_status.eq.auto')
          .order('id')
          .range(from, to),
      )

      return rows
        .map((inv) => ({
          id: inv.id,
          tenant_id: inv.tenant_id,
          amount: Math.max(0, Number(inv.amount) - Number(inv.amount_paid ?? 0)),
          days_overdue: daysOverdue(inv.due_date),
        }))
        .filter((inv) => inv.days_overdue > 0 && inv.amount > 0)
    })

    if (!invoices.length) return { fanned: 0 }

    for (let i = 0; i < invoices.length; i += SEND_CHUNK) {
      const chunk = invoices.slice(i, i + SEND_CHUNK)
      await step.run(`send-events-${i / SEND_CHUNK}`, async () => {
        await inngest.send(
          chunk.map((inv: { id: string; tenant_id: string; amount: number; days_overdue: number }) => ({
            name: 'adminos/invoice.overdue' as const,
            data: {
              invoice_id: inv.id,
              tenant_id: inv.tenant_id,
              amount: inv.amount,
              days_overdue: inv.days_overdue,
            },
          })),
        )
      })
    }

    return { fanned: invoices.length }
  }
)
