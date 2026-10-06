import { inngest } from '@/inngest/client'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { fetchAll } from '@/lib/supabase/fetchAll'
import { notifyTenant } from '@/lib/notifications/notify'
import { pushToUsers, usersWithPermission } from '@/lib/notifications/push'
import { saToday } from '@/lib/people/workingDays'

// 20th of each month, 10:00 SAST — reminds businesses with salaried staff and
// no payroll run for the month to run it before pay day.
//
// Used to `inngest.send('adminos/push.send')`, an event no function listens
// to: in production the reminder went nowhere (Session 20 wiring audit). It now
// goes through the notification spine — the in-app bell and the owner's
// WhatsApp (if set) — and as an app push to whoever holds view_payroll.
// One step per tenant so one failure never skips the rest.
export const payrollReminderCron = inngest.createFunction(
  { id: 'payroll-reminder-cron', triggers: [{ cron: '0 8 20 * *' }] },
  async ({ step }: any) => {
    const [y, m] = saToday().split('-').map(Number)
    const monthName = new Date(Date.UTC(y, m - 1, 1)).toLocaleString('en-ZA', { month: 'long', timeZone: 'UTC' })

    const tenants = await step.run('active-tenants', () =>
      fetchAll<{ id: string }>((from, to) =>
        supabaseAdmin.from('tenants').select('id').eq('active', true).order('id').range(from, to)))

    let reminded = 0
    for (const tenant of tenants) {
      // eslint-disable-next-line no-await-in-loop
      const sent = await step.run(`remind-${tenant.id}`, async () => {
        const { count: staffCount } = await supabaseAdmin
          .from('staff')
          .select('id', { count: 'exact', head: true }).is('deleted_at', null)
          .eq('tenant_id', tenant.id)
          .eq('active', true)
          .not('salary', 'is', null)
        if (!staffCount) return false

        const { data: run } = await supabaseAdmin
          .from('payroll_runs')
          .select('id').is('deleted_at', null)
          .eq('tenant_id', tenant.id)
          .eq('period_month', m)
          .eq('period_year', y)
          .maybeSingle()
        if (run) return false

        const title = 'Payroll reminder'
        const body = `Run ${monthName} payroll for ${staffCount} staff before pay day. PAYE, UIF and SDL are then due to SARS by the 7th.`
        await notifyTenant(tenant.id, {
          type: 'payroll_reminder', title, body, actionUrl: '/dashboard/payroll',
          dedupeKey: `payroll-reminder-${y}-${m}`, dedupeHours: 24 * 10, whatsapp: true,
        })
        const users = await usersWithPermission(tenant.id, 'view_payroll')
        await pushToUsers(tenant.id, users, { title, body, route: '/notifications' })
        return true
      })
      if (sent) reminded++
    }

    return { reminded }
  }
)
