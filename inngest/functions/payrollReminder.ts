import { inngest } from '@/inngest/client'
import { supabaseAdmin } from '@/lib/supabase/admin'

// Runs on the 20th of each month — reminds tenants with active staff to run payroll
export const payrollReminderCron = inngest.createFunction(
  { id: 'payroll-reminder-cron', triggers: [{ cron: '0 8 20 * *' }] },
  async () => {
    const now   = new Date()
    const month = now.getMonth() + 1
    const year  = now.getFullYear()

    // Tenants with active salaried staff but no payroll run this month
    const { data: tenants } = await supabaseAdmin
      .from('tenants')
      .select('id, name')
      .eq('status', 'active')

    let reminded = 0
    for (const tenant of tenants ?? []) {
      // Check if they have salaried staff
      const { count: staffCount } = await supabaseAdmin
        .from('staff')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenant.id)
        .eq('status', 'active')
        .not('salary', 'is', null)

      if (!staffCount) continue

      // Check if payroll already run this month
      const { data: run } = await supabaseAdmin
        .from('payroll_runs')
        .select('id')
        .eq('tenant_id', tenant.id)
        .eq('period_month', month)
        .eq('period_year', year)
        .maybeSingle()

      if (run) continue

      // Queue reminder notification
      await inngest.send({
        name: 'adminos/push.send',
        data: {
          tenantId: tenant.id,
          type:     'payroll_reminder',
          title:    'Payroll reminder',
          body:     `It's the 20th — remember to run payroll for ${new Date(year, month - 1).toLocaleString('en-ZA', { month: 'long' })} before month end.`,
        },
      })

      reminded++
    }

    return { reminded }
  }
)
