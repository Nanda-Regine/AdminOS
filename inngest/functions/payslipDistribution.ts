import { inngest } from '@/inngest/client'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { sendWhatsAppMessage } from '@/lib/whatsapp/send'

// Triggered when a payroll run is finalised — distributes payslip links via WhatsApp
export const payslipDistributionFunction = inngest.createFunction(
  { id: 'payslip-distribution', retries: 2, triggers: [{ event: 'adminos/payroll.run.approved' }] },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async ({ event, step }: any) => {
    const { tenant_id, payroll_run_id } = event.data as {
      tenant_id:      string
      payroll_run_id: string
    }

    // Fetch all payslips for this run with staff details
    const { data: payslips } = await supabaseAdmin
      .from('payslips')
      .select('id, net_pay, staff_id, staff:staff(full_name, phone)')
      .eq('payroll_run_id', payroll_run_id)
      .eq('tenant_id', tenant_id)

    if (!payslips?.length) return { distributed: 0 }

    // Get tenant WhatsApp phone number ID
    const { data: tenant } = await supabaseAdmin
      .from('tenants')
      .select('name, settings')
      .eq('id', tenant_id)
      .single()

    const settings      = tenant?.settings as Record<string, string> | null
    const phoneNumberId = settings?.whatsapp_phone_number_id

    if (!phoneNumberId) return { distributed: 0, reason: 'no_whatsapp_configured' }

    let distributed = 0

    for (const payslip of payslips) {
      const staff = payslip.staff as unknown as Record<string, string> | null
      if (!staff?.phone) continue

      const payslipUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/payroll/payslip/${payslip.id}`

      await step.run(`send-payslip-${payslip.id}`, async () => {
        try {
          const netPay = new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(payslip.net_pay ?? 0)
          await sendWhatsAppMessage(
            phoneNumberId,
            staff.phone,
            `Hi ${staff.full_name ?? 'there'} 👋\n\nYour payslip from ${tenant?.name ?? 'your employer'} is ready.\n\nNet Pay: *${netPay}*\n\nView your payslip here: ${payslipUrl}\n\nThis link is private to you.`,
          )

          await supabaseAdmin
            .from('payslips')
            .update({ delivered_at: new Date().toISOString(), delivery_method: 'whatsapp' })
            .eq('id', payslip.id)

          distributed++
        } catch {
          // Non-fatal — continue
        }
      })
    }

    return { distributed, total: payslips.length }
  }
)
