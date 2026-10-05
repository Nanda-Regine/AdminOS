import { supabaseAdmin } from '@/lib/supabase/admin'
import { inngest } from '@/inngest/client'
import { daysOverdue, todayDateString } from '@/lib/debt/overdue'
import { notifyTenant } from '@/lib/notifications/notify'
import { fetchAll } from '@/lib/supabase/fetchAll'
import { OPEN_INVOICE_STATUSES, outstanding } from '@/lib/invoices/status'
import { withRoute } from '@/lib/api/withRoute'

/**
 * Owner-triggered "Send reminders" — the Money cockpit button.
 *
 * This is an ATTENDED action: the owner explicitly asks AdminOS to chase the
 * overdue book right now. It fans the same `adminos/invoice.overdue` events the
 * daily cron uses, so every send still passes the recovery engine's tier gate
 * (tiers 1–3 only — tier 4+ stays owner-review, the legal boundary) and the
 * content guard. The `manual` flag tells the engine this is owner-authorised, so
 * it does not additionally hold on the unattended-autonomy setting.
 *
 * Fixed 2026-10-05: there was no permission check (any staff login could set
 * debt collection off against every customer), and it only looked at
 * 'unpaid'/'partial' invoices — the app creates them as 'sent', so app-created
 * invoices were never chased. Rate limited: each press can message customers.
 */
export const POST = withRoute({
  action: 'invoices.write',
  audit: 'money_remind_triggered',
  resourceType: 'tenant',
  rateLimit: 'agents',
}, async ({ ctx }) => {
  const { tenantId } = ctx
  const today = todayDateString()

  // Overdue invoices on the automatic track only — never re-chase ones the owner
  // paused (dispute/arrangement), already flagged for review, or approved to send
  // by hand. Mirrors fanOutDebtRecovery's filter, scoped to this tenant.
  const rows = await fetchAll<{ id: string; amount: number; amount_paid: number; due_date: string }>((a, b) =>
    supabaseAdmin
      .from('invoices')
      .select('id, amount, amount_paid, due_date')
      .eq('tenant_id', tenantId)
      .in('status', [...OPEN_INVOICE_STATUSES])
      .lt('due_date', today)
      .is('deleted_at', null)
      .or('recovery_status.is.null,recovery_status.eq.auto')
      .order('id')
      .range(a, b))

  const overdue = rows
    .map((inv) => ({ id: inv.id, amount: outstanding(inv), days_overdue: daysOverdue(inv.due_date) }))
    .filter((inv) => inv.days_overdue > 0 && inv.amount > 0)

  if (overdue.length === 0) {
    return { id: tenantId, queued: 0, message: 'Nothing overdue — collections are clean.' }
  }

  for (let i = 0; i < overdue.length; i += 500) {
    await inngest.send(overdue.slice(i, i + 500).map((inv) => ({
      name: 'adminos/invoice.overdue' as const,
      data: { invoice_id: inv.id, tenant_id: tenantId, amount: inv.amount, days_overdue: inv.days_overdue, manual: true },
    })))
  }

  // Confirm back to the owner in the bell too, so the action leaves a trace.
  await notifyTenant(tenantId, {
    type: 'recovery.sent',
    title: 'Reminders queued',
    body: `Chasing ${overdue.length} overdue ${overdue.length === 1 ? 'invoice' : 'invoices'}. Gentle reminders go out now; anything past the reminder stage waits for your review.`,
    actionUrl: '/dashboard/invoices',
    dedupeKey: `money-remind-${today}`,
    dedupeHours: 6,
  })

  return {
    id: tenantId,
    queued: overdue.length,
    message: `Chasing ${overdue.length} overdue ${overdue.length === 1 ? 'invoice' : 'invoices'} now.`,
  }
})
