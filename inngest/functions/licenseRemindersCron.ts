import { inngest } from '@/inngest/client'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const licenseRemindersCronFunction = inngest.createFunction(
  { id: 'license-reminders-cron', retries: 1, triggers: [{ cron: '0 7 * * 1' }] },
  async ({ step }: any) => {
    const today = new Date().toISOString().split('T')[0]

    const licenses = await step.run('fetch-licenses', async () => {
      const { data } = await supabaseAdmin
        .from('professional_licenses')
        .select('id, tenant_id, license_type, license_number, issuing_body, expiry_date, renewal_reminder_days')
        .not('expiry_date', 'is', null)
        .gte('expiry_date', today)
      return data ?? []
    })

    if (!licenses.length) return { checked: 0, created: 0 }

    let created = 0

    for (const lic of licenses) {
      const reminderDate = new Date(
        new Date(lic.expiry_date).getTime() - lic.renewal_reminder_days * 86400000
      ).toISOString().split('T')[0]

      if (today < reminderDate) continue

      await step.run(`license-reminder-${lic.id}`, async () => {
        const { data: existing } = await supabaseAdmin
          .from('compliance_items')
          .select('id')
          .eq('tenant_id', lic.tenant_id)
          .eq('item_type', 'license_renewal')
          .ilike('title', `%${lic.license_type}%`)
          .not('status', 'in', '(completed,not_applicable)')
          .maybeSingle()

        if (existing) return

        await supabaseAdmin.from('compliance_items').insert({
          tenant_id:           lic.tenant_id,
          item_type:           'license_renewal',
          title:               `Renew: ${lic.license_type}${lic.license_number ? ` (${lic.license_number})` : ''}`,
          description:         lic.issuing_body ? `Issued by ${lic.issuing_body}` : null,
          due_date:            lic.expiry_date,
          penalty_description: 'Operating with an expired professional license may result in regulatory action.',
        })
        created++
      })
    }

    return { checked: licenses.length, created }
  }
)
