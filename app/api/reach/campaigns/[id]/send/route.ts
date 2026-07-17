import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireAddon } from '@/lib/billing/gates'
import { sendWhatsAppMessage } from '@/lib/whatsapp/send'

export const runtime = 'nodejs'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  try {
    await requireAddon('reach')
  } catch {
    return NextResponse.json({ error: 'Reach add-on required' }, { status: 403 })
  }

  const { id } = await params
  const tenantId = user.app_metadata?.tenant_id as string

  const { data: campaign } = await supabaseAdmin
    .from('broadcast_campaigns')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single()

  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
  if (campaign.status === 'sent' || campaign.status === 'sending') {
    return NextResponse.json({ error: 'Campaign already sent' }, { status: 409 })
  }
  if (!campaign.message_body) {
    return NextResponse.json({ error: 'Campaign has no message body' }, { status: 400 })
  }

  const { data: tenant } = await supabaseAdmin
    .from('tenants')
    .select('id, meta_phone_number_id')
    .eq('id', tenantId)
    .single()

  if (!tenant?.meta_phone_number_id) {
    return NextResponse.json({ error: 'Meta WhatsApp not configured for this account' }, { status: 400 })
  }

  // Build audience query from filter
  const filter = (campaign.audience_filter ?? {}) as { contact_type?: string[] }

  let query = supabaseAdmin
    .from('contacts')
    .select('id, phone, full_name')
    .eq('tenant_id', tenantId)
    .not('phone', 'is', null)
    .neq('phone', '')

  if (filter.contact_type?.length) {
    query = query.in('contact_type', filter.contact_type)
  }

  const { data: contacts } = await query

  if (!contacts?.length) {
    return NextResponse.json({ error: 'No contacts match the audience filter' }, { status: 400 })
  }

  // Mark sending immediately so UI reflects state
  await supabaseAdmin
    .from('broadcast_campaigns')
    .update({ status: 'sending', total_recipients: contacts.length })
    .eq('id', id)

  // Fan out async — return 202 immediately
  void dispatchCampaign(
    campaign.id,
    tenantId,
    contacts as Array<{ id: string; phone: string; full_name: string | null }>,
    campaign.message_body as string,
    tenant.meta_phone_number_id as string,
  )

  return NextResponse.json(
    { ok: true, total_recipients: contacts.length },
    { status: 202 }
  )
}

async function dispatchCampaign(
  campaignId: string,
  tenantId: string,
  contacts: Array<{ id: string; phone: string; full_name: string | null }>,
  messageBody: string,
  phoneNumberId: string,
) {
  let sentCount = 0
  let failedCount = 0

  for (const contact of contacts) {
    try {
      const { messageId } = await sendWhatsAppMessage(phoneNumberId, contact.phone, messageBody)
      await supabaseAdmin.from('broadcast_recipients').insert({
        campaign_id: campaignId,
        tenant_id:   tenantId,
        contact_id:  contact.id,
        phone:       contact.phone,
        status:      'sent',
        message_id:  messageId,
        sent_at:     new Date().toISOString(),
      }).then(() => {}, () => {})
      sentCount++
    } catch (err) {
      await supabaseAdmin.from('broadcast_recipients').insert({
        campaign_id:   campaignId,
        tenant_id:     tenantId,
        contact_id:    contact.id,
        phone:         contact.phone,
        status:        'failed',
        error_message: err instanceof Error ? err.message : 'Send failed',
        failed_at:     new Date().toISOString(),
      }).then(() => {}, () => {})
      failedCount++
    }
  }

  await supabaseAdmin
    .from('broadcast_campaigns')
    .update({
      status:       'sent',
      sent_at:      new Date().toISOString(),
      sent_count:   sentCount,
      failed_count: failedCount,
    })
    .eq('id', campaignId)
    .then(() => {}, () => {})
}
