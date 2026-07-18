import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { inngest } from '@/inngest/client'
import { daysOverdue, todayDateString } from '@/lib/debt/overdue'
import { notifyTenant } from '@/lib/notifications/notify'
import { writeAuditLog } from '@/lib/security/audit'

/**
 * Owner-triggered "Send reminders" — the Money cockpit button.
 *
 * This is an ATTENDED action: the owner explicitly asks AdminOS to chase the
 * overdue book right now. It fans the same `adminos/invoice.overdue` events the
 * daily cron uses, so every send still passes the recovery engine's tier gate
 * (tiers 1–3 only — tier 4+ stays owner-review, the legal boundary) and the
 * content guard. The `manual` flag tells the engine this is owner-authorised, so
 * it does not additionally hold on the unattended-autonomy setting: autonomy
 * governs what the machine does on its own, not what the owner asks for by hand.
 */
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.app_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  // Overdue invoices on the automatic track only — never re-chase ones the owner
  // paused (dispute/arrangement), already flagged for review, or approved to send
  // by hand. Mirrors fanOutDebtRecovery's filter, scoped to this tenant.
  const { data, error } = await supabaseAdmin
    .from('invoices')
    .select('id, amount, due_date')
    .eq('tenant_id', tenantId)
    .in('status', ['unpaid', 'partial'])
    .lt('due_date', todayDateString())
    .or('recovery_status.is.null,recovery_status.eq.auto')
    .order('due_date', { ascending: true })
    .limit(500)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const overdue = (data ?? [])
    .map((inv) => ({ id: inv.id, amount: inv.amount, days_overdue: daysOverdue(inv.due_date) }))
    .filter((inv) => inv.days_overdue > 0)

  if (overdue.length === 0) {
    return NextResponse.json({ queued: 0, message: 'Nothing overdue — collections are clean.' })
  }

  await inngest.send(
    overdue.map((inv) => ({
      name: 'adminos/invoice.overdue' as const,
      data: { invoice_id: inv.id, tenant_id: tenantId, amount: inv.amount, days_overdue: inv.days_overdue, manual: true },
    })),
  )

  await writeAuditLog({
    tenantId,
    actor: user.id,
    action: 'money_remind_triggered',
    resourceType: 'tenant',
    resourceId: tenantId,
    metadata: { queued: overdue.length },
  })

  // Confirm back to the owner in the bell too, so the action leaves a trace.
  await notifyTenant(tenantId, {
    type: 'recovery.sent',
    title: 'Reminders queued',
    body: `Chasing ${overdue.length} overdue ${overdue.length === 1 ? 'invoice' : 'invoices'}. Gentle reminders go out now; anything past the reminder stage waits for your review.`,
    actionUrl: '/dashboard/invoices',
    dedupeKey: `money-remind-${todayDateString()}`,
    dedupeHours: 6,
  })

  return NextResponse.json({
    queued: overdue.length,
    message: `Chasing ${overdue.length} overdue ${overdue.length === 1 ? 'invoice' : 'invoices'} now.`,
  })
}
