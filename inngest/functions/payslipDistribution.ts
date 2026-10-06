import { inngest } from '@/inngest/client'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { sendWhatsAppMessage } from '@/lib/whatsapp/send'
import { tenantPhoneNumberId } from '@/lib/whatsapp/tenantSender'
import { notifyTenant } from '@/lib/notifications/notify'

type Outcome = { staff: string; result: 'sent' | 'no_phone' | 'failed'; reason?: string }

// Triggered when the owner distributes a finalised payroll run
// (app/api/payroll/[id]/distribute). WhatsApps each employee a link to their
// own payslip, then tells the owner exactly who did and didn't get one.
//
// Fixed 2026-10-05:
// - The link pointed at a login-only route (0 of 12 live staff have a login)
//   that also 404'd on non-existent columns. It is now the payslip's
//   expiring view token (app/api/payslips/view/[token]).
// - `distributed++` ran inside step.run, whose body is skipped on Inngest
//   replays — so the count was wrong. Each step now returns its outcome.
// - Failures were swallowed by an empty catch. They are now returned and
//   reported to the owner, so nobody silently goes without a payslip.
// - Free-form WhatsApp only reaches people who messaged the business in the
//   last 24h. A Meta-approved payslip template is needed for the rest; until
//   then those show up in the owner's "not delivered" list.
export const payslipDistributionFunction = inngest.createFunction(
  { id: 'payslip-distribution', retries: 2, triggers: [{ event: 'adminos/payroll.run.approved' }] },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async ({ event, step }: any) => {
    const { tenant_id, payroll_run_id } = event.data as { tenant_id: string; payroll_run_id: string }

    const ctx = await step.run('load', async () => {
      const [{ data: payslips }, { data: tenant }, { data: run }] = await Promise.all([
        supabaseAdmin
          .from('payslips')
          .select('id, net_pay, view_token, staff:staff(full_name, phone)')
          .eq('payroll_run_id', payroll_run_id)
          .eq('tenant_id', tenant_id)
          .is('deleted_at', null),
        supabaseAdmin.from('tenants').select('name').eq('id', tenant_id).single(),
        supabaseAdmin.from('payroll_runs').select('period_month, period_year').is('deleted_at', null).eq('id', payroll_run_id).eq('tenant_id', tenant_id).single(),
      ])
      return {
        payslips: (payslips ?? []).map((p) => {
          const staff = p.staff as unknown as { full_name?: string; phone?: string } | null
          return { id: p.id, net_pay: Number(p.net_pay ?? 0), token: p.view_token as string | null, name: staff?.full_name ?? 'Employee', phone: staff?.phone ?? null }
        }),
        tenantName: tenant?.name ?? 'your employer',
        // Was settings.whatsapp_phone_number_id, which nothing sets: every
        // payslip came back "WhatsApp not connected". The business's line,
        // else the platform line (lib/whatsapp/tenantSender.ts).
        phoneNumberId: await tenantPhoneNumberId(tenant_id),
        period: run ? new Date(run.period_year, run.period_month - 1, 1).toLocaleDateString('en-ZA', { timeZone: 'Africa/Johannesburg', month: 'long', year: 'numeric' }) : '',
      }
    })

    if (!ctx.payslips.length) return { sent: 0, total: 0 }

    const outcomes: Outcome[] = []
    for (const p of ctx.payslips) {
      const outcome: Outcome = await step.run(`send-payslip-${p.id}`, async () => {
        if (!p.phone) return { staff: p.name, result: 'no_phone' as const }
        if (!ctx.phoneNumberId) return { staff: p.name, result: 'failed' as const, reason: 'WhatsApp not connected' }
        if (!p.token) return { staff: p.name, result: 'failed' as const, reason: 'no view link — recalculate payroll' }
        const url = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://adminos.co.za'}/api/payslips/view/${p.token}`
        const netPay = new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(p.net_pay)
        try {
          await sendWhatsAppMessage(
            ctx.phoneNumberId,
            p.phone,
            `Hi ${p.name} 👋\n\nYour ${ctx.period} payslip from ${ctx.tenantName} is ready.\n\nNet pay: *${netPay}*\n\nView it here (private to you, valid for 60 days):\n${url}`,
          )
        } catch (e) {
          return { staff: p.name, result: 'failed' as const, reason: e instanceof Error ? e.message.slice(0, 120) : 'send failed' }
        }
        await supabaseAdmin
          .from('payslips')
          .update({ sent_at: new Date().toISOString(), delivered_at: new Date().toISOString(), delivery_method: 'whatsapp' })
          .eq('id', p.id)
          .eq('tenant_id', tenant_id)
        return { staff: p.name, result: 'sent' as const }
      })
      outcomes.push(outcome)
    }

    const sent = outcomes.filter((o) => o.result === 'sent').length
    const missed = outcomes.filter((o) => o.result !== 'sent')

    await step.run('notify-owner', async () => {
      const names = missed.slice(0, 8).map((o) => o.staff).join(', ') + (missed.length > 8 ? ` and ${missed.length - 8} more` : '')
      await notifyTenant(tenant_id, {
        type: missed.length ? 'payroll.distribution_incomplete' : 'payroll.distributed',
        title: missed.length ? `Payslips: ${sent} sent, ${missed.length} not delivered` : `All ${sent} payslips sent`,
        body: missed.length
          ? `Not delivered to ${names}. Open Payroll to download their payslips and share them directly.`
          : `Every employee has their ${ctx.period} payslip on WhatsApp.`,
        actionUrl: '/dashboard/payroll',
        dedupeKey: `payslips-${payroll_run_id}`,
      })
    })

    return { sent, total: ctx.payslips.length, missed }
  }
)
