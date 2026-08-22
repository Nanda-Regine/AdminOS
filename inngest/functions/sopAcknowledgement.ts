import { inngest } from '@/inngest/client'
import { supabaseAdmin } from '@/lib/supabase/admin'

// Runs every Friday at 9am — reminds staff who haven't acknowledged required SOPs
export const sopAcknowledgementFunction = inngest.createFunction(
  { id: 'sop-acknowledgement-weekly', retries: 2, triggers: [{ cron: '0 9 * * 5' }] },
  async ({ step }: any) => {
    // Step 1: Fetch all SOPs that require acknowledgement (across all tenants).
    // Table is sop_documents, not sops; the flag is requires_acknowledgement.
    const sops = await step.run('get-required-sops', async () => {
      const { data } = await supabaseAdmin
        .from('sop_documents')
        .select('id, tenant_id, title, requires_acknowledgement')
        .eq('requires_acknowledgement', true)

      return data ?? []
    })

    if (sops.length === 0) return { sops_checked: 0, notifications_sent: 0 }

    let totalNotifications = 0

    for (const sop of sops) {
      // eslint-disable-next-line no-await-in-loop
      const count = await step.run(`check-sop-${sop.id}`, async () => {
        // Get all staff for this tenant who have a linked login — sop_
        // acknowledgements keys on user_id, not staff_id (it has no
        // staff_id column at all), so a staff row with no user_id can't be
        // tracked for acknowledgement either way.
        const { data: allStaff } = await supabaseAdmin
          .from('staff')
          .select('id, tenant_id, user_id, full_name, phone')
          .eq('tenant_id', sop.tenant_id)
          .not('user_id', 'is', null)

        if (!allStaff || allStaff.length === 0) return 0

        // Get users who have already acknowledged this SOP
        const { data: acks } = await supabaseAdmin
          .from('sop_acknowledgements')
          .select('user_id')
          .eq('sop_id', sop.id)

        const acknowledgedUserIds = new Set((acks ?? []).map((a) => a.user_id as string))

        // Find unacknowledged staff
        const unacknowledged = allStaff.filter((s) => !acknowledgedUserIds.has(s.user_id as string))

        if (unacknowledged.length === 0) return 0

        // Insert notifications for each unacknowledged staff member
        const now = new Date().toISOString()
        const notifications = unacknowledged.map((s) => ({
          tenant_id: sop.tenant_id,
          user_id: s.user_id,
          type: 'sop_acknowledgement_reminder',
          title: `Please acknowledge: ${sop.title}`,
          body: `You have a required SOP to acknowledge: "${sop.title}". Please read and confirm you understand this procedure.`,
          read: false,
          data: { sop_id: sop.id, staff_id: s.id },
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
