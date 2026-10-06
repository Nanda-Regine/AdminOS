import { inngest } from '@/inngest/client'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { notifyTenant } from '@/lib/notifications/notify'
import { writeAuditLog } from '@/lib/security/audit'

export const escalateConversationsCron = inngest.createFunction(
  { id: 'escalate-conversations-cron', retries: 1, concurrency: { limit: 5 }, triggers: [{ cron: '*/15 * * * *' }] },
  async ({ step }: { step: any }) => {
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()

    const staleConvs = await step.run('fetch-stale-conversations', async () => {
      const { data, error } = await supabaseAdmin
        .from('conversations')
        .select('id, tenant_id, contact_identifier, contact_name, intent, updated_at')
        .eq('status', 'open')
        .lt('updated_at', cutoff)
        .limit(100)
      if (error) throw error
      return data ?? []
    })

    if (staleConvs.length === 0) return { escalated: 0 }

    const tenantIds = [...new Set(staleConvs.map((c: { tenant_id: string }) => c.tenant_id))]

    const tenantMap = await step.run('fetch-tenants', async () => {
      const { data } = await supabaseAdmin
        .from('tenants')
        .select('id, name')
        .in('id', tenantIds)
      return Object.fromEntries((data ?? []).map((t: { id: string; name: string }) => [t.id, t]))
    })

    let escalated = 0

    for (const conv of staleConvs) {
      await step.run(`escalate-${conv.id}`, async () => {
        await supabaseAdmin
          .from('conversations')
          .update({ status: 'escalated' })
          .eq('id', conv.id)

        // Owner alert through the normal path (bell + the owner's notify
        // phone, quiet hours respected). It used to WhatsApp
        // tenants.whatsapp_number — the business's own customer-facing line.
        if (tenantMap[conv.tenant_id]) {
          const contactLabel = conv.contact_name || conv.contact_identifier || 'a contact'
          const hoursOpen    = Math.round((Date.now() - new Date(conv.updated_at).getTime()) / 3_600_000)
          await notifyTenant(conv.tenant_id, {
            type: 'conversation.escalated',
            title: 'Customer waiting for a reply',
            body: `${contactLabel} (${conv.intent || 'general enquiry'}) has been waiting ${hoursOpen} hours.`,
            actionUrl: '/dashboard/inbox',
            dedupeKey: `escalated-${conv.id}`,
            whatsapp: true,
          }).catch((err) => console.error('[Escalation] notify failed:', err))
        }

        await writeAuditLog({
          tenantId: conv.tenant_id,
          actor:    'system',
          action:   'conversation.auto_escalated',
          metadata: { conversationId: conv.id, hoursOpen: 48 },
        })
      })
      escalated++
    }

    return { escalated, total: staleConvs.length }
  }
)
