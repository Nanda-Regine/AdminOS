import { inngest } from '@/inngest/client'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { sendWhatsApp } from '@/lib/whatsapp/send'
import { buildSalesIntel } from '@/lib/sales/signal'
import { notifyTenant } from '@/lib/notifications/notify'
import { getTenantAutonomy } from '@/lib/autonomy/config'
import { resolveTier } from '@/lib/autonomy/tiers'
import { checkBudget } from '@/lib/ai/costControls'
import { draftColdLeadMessage } from '@/lib/ai/callClaude'

// Autonomy: sales/going_cold_nudge (default B — draft, owner sends; a tenant
// may opt into A to have AdminOS message the customer directly). Weekly,
// fans over active tenants. Capped to the 3 highest-value stale contacts per
// run to bound AI + WhatsApp volume — this is a gentle nudge, not a blast.
const MAX_PER_RUN = 3

export const coldLeadNudgeCron = inngest.createFunction(
  { id: 'cold-lead-nudge-cron', retries: 0, triggers: [{ cron: 'TZ=Africa/Johannesburg 0 8 * * 1' }] },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async ({ step }: any) => {
    const tenants = await step.run('fetch-tenants', async () => {
      const { data } = await supabaseAdmin.from('tenants').select('id').eq('active', true)
      return data ?? []
    })
    if (!tenants.length) return { fanned: 0 }

    await step.run('send-events', async () => {
      await inngest.send(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tenants.map((t: any) => ({ name: 'adminos/sales.cold-lead-check' as const, data: { tenant_id: t.id } })),
      )
    })
    return { fanned: tenants.length }
  },
)

export const coldLeadNudgeEngine = inngest.createFunction(
  { id: 'cold-lead-nudge-engine', retries: 2, triggers: [{ event: 'adminos/sales.cold-lead-check' }] },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async ({ event, step }: any) => {
    const { tenant_id } = event.data as { tenant_id: string }

    const context = await step.run('load-context', async () => {
      const [intel, tenantRes] = await Promise.all([
        buildSalesIntel(tenant_id),
        supabaseAdmin.from('tenants').select('name, plan').eq('id', tenant_id).maybeSingle(),
      ])
      return { staleContacts: intel.staleContacts, tenant: tenantRes.data }
    })
    if (!context.staleContacts.length) return { tenant_id, status: 'none' }

    const tier = await step.run('resolve-autonomy', async () => {
      return resolveTier(await getTenantAutonomy(tenant_id), 'sales', 'going_cold_nudge')
    })

    // Tier C: surface the list only — no AI spend, no customer contact.
    if (tier === 'C') {
      await step.run('notify-surface-only', async () => {
        const names = context.staleContacts.slice(0, MAX_PER_RUN).map((c: { name: string }) => c.name).join(', ')
        await notifyTenant(tenant_id, {
          type: 'sales.going_cold',
          title: `${context.staleContacts.length} contact${context.staleContacts.length === 1 ? '' : 's'} going cold`,
          body: `Not contacted in 30+ days: ${names}.`,
          actionUrl: '/dashboard/sales',
          dedupeKey: `cold-lead-${tenant_id}-${new Date().toISOString().slice(0, 10)}`,
          dedupeHours: 24 * 6,
          whatsapp: true,
        })
      })
      return { tenant_id, status: 'surfaced', count: context.staleContacts.length }
    }

    const targets = context.staleContacts.slice(0, MAX_PER_RUN) as
      { id: string; name: string; lastContacted: string | null; phone: string | null }[]
    const plan = context.tenant?.plan ?? 'trial'
    const tenantName = context.tenant?.name ?? 'our business'

    type Draft = { id: string; name: string; phone: string | null; text: string | null }

    const drafts: Draft[] = await step.run('draft-messages', async () => {
      const out: Draft[] = []
      for (const c of targets) {
        const budget = await checkBudget(tenant_id, plan, 150)
        if (!budget.allowed) { out.push({ id: c.id, name: c.name, phone: c.phone, text: null }); continue }
        const daysSince = c.lastContacted
          ? Math.floor((Date.now() - new Date(c.lastContacted).getTime()) / 86400000)
          : null
        const text = await draftColdLeadMessage({ tenantName, contact: c.name, daysSinceContact: daysSince })
        out.push({ id: c.id, name: c.name, phone: c.phone, text: text || null })
      }
      return out
    })

    // Tier B: draft only — owner sends themselves.
    if (tier === 'B') {
      await step.run('notify-drafts', async () => {
        const drafted = drafts.filter((d: Draft) => d.text)
        if (!drafted.length) return
        const body = drafted.map((d: Draft) => `${d.name}: "${d.text}"`).join('\n\n')
        await notifyTenant(tenant_id, {
          type: 'sales.going_cold',
          title: `${drafted.length} re-engagement message${drafted.length === 1 ? '' : 's'} ready to send`,
          body: `Auto-send is off — drafts ready to copy and send yourself:\n\n${body}`,
          actionUrl: '/dashboard/sales',
          dedupeKey: `cold-lead-${tenant_id}-${new Date().toISOString().slice(0, 10)}`,
          dedupeHours: 24 * 6,
          whatsapp: true,
        })
      })
      return { tenant_id, status: 'drafted', count: drafts.filter((d: Draft) => d.text).length }
    }

    // Tier A: send directly to each contact with a phone number on file.
    const sent = await step.run('send-messages', async () => {
      let count = 0
      for (const d of drafts) {
        if (!d.text || !d.phone) continue
        try {
          await sendWhatsApp({ to: d.phone, message: d.text })
          await supabaseAdmin.from('contacts').update({ last_contacted_at: new Date().toISOString() }).eq('id', d.id)
          count++
        } catch (err) {
          console.error('[coldLeadNudge] send failed (non-fatal)', err)
        }
      }
      return count
    })

    if (sent > 0) {
      await step.run('notify-sent', async () => {
        await notifyTenant(tenant_id, {
          type: 'sales.going_cold',
          title: `Reached out to ${sent} cold contact${sent === 1 ? '' : 's'}`,
          body: `AdminOS sent a re-engagement message to ${sent} contact${sent === 1 ? '' : 's'} who'd gone quiet.`,
          actionUrl: '/dashboard/sales',
          dedupeKey: `cold-lead-sent-${tenant_id}-${new Date().toISOString().slice(0, 10)}`,
          dedupeHours: 24 * 6,
          whatsapp: false,
        })
      })
    }

    return { tenant_id, status: 'sent', count: sent }
  },
)
