import { inngest } from '@/inngest/client'
import { supabaseAdmin } from '@/lib/supabase/admin'

// Runs every Friday at 9am — reminds staff who haven't acknowledged required SOPs
export const sopAcknowledgementFunction = inngest.createFunction(
  { id: 'sop-acknowledgement-weekly', retries: 2 },
  { cron: '0 9 * * 5' },
  async ({ step }) => {
    // Step 1: Fetch all SOPs that require acknowledgement (across all tenants)
    const sops = await step.run('get-required-sops', async () => {
      const { data } = await supabaseAdmin
        .from('sops')
        .select('id, tenant_id, title, acknowledgement_required')
        .eq('acknowledgement_required', true)

      return data ?? []
    })

    if (sops.length === 0) return { sops_checked: 0, notifications_sent: 0 }

    let totalNotifications = 0

    for (const sop of sops) {
      // eslint-disable-next-line no-await-in-loop
      const count = await step.run(`check-sop-${sop.id}`, async () => {
        // Get all staff for this tenant
        const { data: allStaff } = await supabaseAdmin
          .from('staff')
          .select('id, tenant_id, user_id, full_name, phone')
          .eq('tenant_id', sop.tenant_id)

        if (!allStaff || allStaff.length === 0) return 0

        // Get staff who have already acknowledged this SOP
        const { data: acks } = await supabaseAdmin
          .from('sop_acknowledgements')
          .select('staff_id')
          .eq('sop_id', sop.id)

        const acknowledgedIds = new Set((acks ?? []).map((a) => a.staff_id as string))

        // Find unacknowledged staff
        const unacknowledged = allStaff.filter((s) => !acknowledgedIds.has(s.id))

        if (unacknowledged.length === 0) return 0

        // Insert notifications for each unacknowledged staff member
        const now = new Date().toISOString()
        const notifications = unacknowledged.map((s) => ({
          tenant_id: sop.tenant_id,
          user_id: s.user_id ?? null,
          type: 'sop_acknowledgement_reminder',
          title: `Please acknowledge: ${sop.title}`,
          body: `You have a required SOP to acknowledge: "${sop.title}". Please read and confirm you understand this procedure.`,
          read: false,
          metadata: { sop_id: sop.id, staff_id: s.id },
          created_at: now,
        }))

        const { error } = await supabaseAdmin.from('notifications').insert(notifications)
        if (error) throw new Error(`Failed to insert SOP notifications for ${sop.id}: ${error.message}`)

        return notifications.length
      })

      totalNotifications += count
    }

    return { sops_checked: sops.length, notifications_sent: totalNotifications }
  }
)
