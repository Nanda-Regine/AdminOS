import { inngest } from '@/inngest/client'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY!)

export const trialNudgeSequence = inngest.createFunction(
  { id: 'trial-nudge-sequence', retries: 1, triggers: [{ event: 'adminos/trial.expiring' }] },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async ({ event, step }: any) => {
    const { tenant_id, days_remaining } = event.data as { tenant_id: string; days_remaining: number }

    const tenant = await step.run('load-tenant', async () => {
      const { data } = await supabaseAdmin
        .from('tenants')
        .select('name, settings')
        .eq('id', tenant_id)
        .single()
      return data
    })

    const ownerEmail = (tenant?.settings as Record<string, string>)?.owner_email
    const ownerName  = (tenant?.settings as Record<string, string>)?.owner_name ?? 'there'
    const businessName = tenant?.name ?? 'your business'

    if (!ownerEmail) return { status: 'no_email' }

    const urgency = days_remaining <= 2 ? 'final' : days_remaining <= 5 ? 'urgent' : 'friendly'

    const subjects: Record<string, string> = {
      friendly: `${days_remaining} days left on your AdminOS trial — see what's been happening`,
      urgent:   `Only ${days_remaining} days left — AdminOS needs to stay on for ${businessName}`,
      final:    `Last chance: your AdminOS trial expires in ${days_remaining} day${days_remaining === 1 ? '' : 's'}`,
    }

    const [convCount, invoiceCount, docsCount] = await step.run('get-roi-data', async () => {
      const [c, i, d] = await Promise.all([
        supabaseAdmin.from('conversations').select('id', { count: 'exact' }).eq('tenant_id', tenant_id),
        supabaseAdmin.from('invoices').select('id', { count: 'exact' }).eq('tenant_id', tenant_id),
        supabaseAdmin.from('documents').select('id', { count: 'exact' }).eq('tenant_id', tenant_id),
      ])
      return [c.count ?? 0, i.count ?? 0, d.count ?? 0]
    })

    await step.run('send-nudge-email', async () => {
      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL!,
        to: ownerEmail,
        subject: subjects[urgency],
        html: `
<h2>Hi ${ownerName},</h2>
<p>Your AdminOS trial has ${days_remaining} day${days_remaining === 1 ? '' : 's'} remaining.</p>
<p>Here's what your AI agents have accomplished during your trial:</p>
<ul>
  <li>💬 <strong>${convCount}</strong> customer conversations handled</li>
  <li>💰 <strong>${invoiceCount}</strong> invoices tracked & chased</li>
  <li>📄 <strong>${docsCount}</strong> documents processed</li>
</ul>
<p>Keep the momentum going — upgrade ${businessName} to continue.</p>
<p><a href="https://adminos.co.za/dashboard/settings/billing" style="background:#2D4A22;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;">Upgrade now →</a></p>
        `,
      })
    })

    return { tenant_id, days_remaining, urgency, status: 'sent' }
  }
)
