import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

// GET /api/cron/license-reminders
// Weekly: find licenses expiring within their renewal_reminder_days window
// Creates compliance_items for upcoming renewals

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const today = new Date().toISOString().split('T')[0]

  // Fetch all licenses that haven't expired yet
  const { data: licenses, error } = await supabaseAdmin
    .from('professional_licenses')
    .select('id, tenant_id, license_type, license_number, issuing_body, expiry_date, renewal_reminder_days')
    .not('expiry_date', 'is', null)
    .gte('expiry_date', today)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  let created = 0

  for (const lic of licenses ?? []) {
    const reminderDate = new Date(
      new Date(lic.expiry_date).getTime() - lic.renewal_reminder_days * 86400000
    ).toISOString().split('T')[0]

    // Only trigger if today is past the reminder window start
    if (today >= reminderDate) {
      // Check if a compliance item already exists for this license renewal
      const { data: existing } = await supabaseAdmin
        .from('compliance_items')
        .select('id')
        .eq('tenant_id', lic.tenant_id)
        .eq('item_type', 'license_renewal')
        .ilike('title', `%${lic.license_type}%`)
        .not('status', 'in', '(completed,not_applicable)')
        .maybeSingle()

      if (!existing) {
        await supabaseAdmin.from('compliance_items').insert({
          tenant_id:           lic.tenant_id,
          item_type:           'license_renewal',
          title:               `Renew: ${lic.license_type}${lic.license_number ? ` (${lic.license_number})` : ''}`,
          description:         lic.issuing_body ? `Issued by ${lic.issuing_body}` : null,
          due_date:            lic.expiry_date,
          penalty_description: 'Operating with an expired professional license may result in regulatory action.',
        })
        created++
      }
    }
  }

  return NextResponse.json({ checked: licenses?.length ?? 0, created })
}
