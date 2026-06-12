import { inngest } from '@/inngest/client'
import { supabaseAdmin } from '@/lib/supabase/admin'

// Runs every Monday at 9am — nudges informal businesses through the formalization pathway
export const formalizationNudgeFunction = inngest.createFunction(
  { id: 'formalization-nudge-weekly', retries: 2 },
  { cron: '0 9 * * 1' },
  async ({ step }) => {
    // Step 1: Fetch all tenants at 'informal' stage
    const targets = await step.run('get-informal-tenants', async () => {
      const { data } = await supabaseAdmin
        .from('formalization_progress')
        .select('tenant_id, stage, cipc_registered, tax_registered, bank_account, first_invoice_sent, first_staff_added')
        .eq('stage', 'informal')

      return data ?? []
    })

    if (targets.length === 0) return { nudged: 0, skipped: 0 }

    let nudged = 0
    let skipped = 0

    // Step 2: For each informal tenant, check incomplete steps and send nudges
    for (const tenant of targets) {
      // eslint-disable-next-line no-await-in-loop
      const result = await step.run(`nudge-${tenant.tenant_id}`, async () => {
        const incompleteSteps: Array<{ step: string; title: string; body: string }> = []

        if (!tenant.cipc_registered) {
          incompleteSteps.push({
            step: 'cipc_registration',
            title: 'Register your business with CIPC',
            body: 'Formal registration protects your brand, unlocks business banking, and is required for most contracts. It only takes a few days.',
          })
        }
        if (!tenant.tax_registered) {
          incompleteSteps.push({
            step: 'tax_registration',
            title: 'Register for tax with SARS',
            body: 'Getting your Income Tax number lets you issue valid invoices and access tax benefits. Register on eFiling — it\'s free.',
          })
        }
        if (!tenant.bank_account) {
          incompleteSteps.push({
            step: 'bank_account',
            title: 'Open a business bank account',
            body: 'Separating personal and business finances is the first step to financial clarity. Many banks offer free starter accounts.',
          })
        }
        if (!tenant.first_invoice_sent) {
          incompleteSteps.push({
            step: 'first_invoice',
            title: 'Send your first professional invoice',
            body: 'You can create and send a professional invoice right here in AdminOS. Make it official.',
          })
        }
        if (!tenant.first_staff_added) {
          incompleteSteps.push({
            step: 'first_staff',
            title: 'Add your team to AdminOS',
            body: 'Even if it\'s just one person, adding staff unlocks payroll, leave management, and wellness tracking.',
          })
        }

        if (incompleteSteps.length === 0) return { status: 'complete' }

        // Check which steps were nudged in the last 7 days to avoid repeat nudges
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
        const { data: recentNudges } = await supabaseAdmin
          .from('notifications')
          .select('body')
          .eq('tenant_id', tenant.tenant_id)
          .eq('type', 'formalization_nudge')
          .gte('created_at', sevenDaysAgo)

        const recentlyNudgedSteps = new Set(
          (recentNudges ?? []).map((n) => n.body?.split('::')[0] ?? '')
        )

        const toNudge = incompleteSteps.filter((s) => !recentlyNudgedSteps.has(s.step))
        if (toNudge.length === 0) return { status: 'skipped', reason: 'all_recently_nudged' }

        const now = new Date().toISOString()
        const notifications = toNudge.map((s) => ({
          tenant_id: tenant.tenant_id,
          user_id: null as string | null,
          type: 'formalization_nudge',
          title: s.title,
          // Embed step key in body for dedup check above
          body: `${s.step}::${s.body}`,
          read: false,
          created_at: now,
        }))

        const { error } = await supabaseAdmin.from('notifications').insert(notifications)
        if (error) throw new Error(`Insert failed for ${tenant.tenant_id}: ${error.message}`)

        return { status: 'nudged', count: notifications.length }
      })

      if (result.status === 'nudged') nudged++
      else skipped++
    }

    return { processed: targets.length, nudged, skipped }
  }
)
