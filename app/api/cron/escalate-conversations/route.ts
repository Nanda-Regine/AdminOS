import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { sendWhatsApp } from '@/lib/whatsapp/send'
import { writeAuditLog } from '@/lib/security/audit'

export const runtime    = 'nodejs'
export const maxDuration = 60

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  // Find conversations that have been open for more than 48 hours
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()

  const { data: staleConvs, error } = await supabaseAdmin
    .from('conversations')
    .select('id, tenant_id, contact_identifier, contact_name, intent, updated_at')
    .eq('status', 'open')
    .lt('updated_at', cutoff)
    .limit(100)

  if (error) {
    console.error('[Escalation Cron] Query failed:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!staleConvs?.length) {
    return NextResponse.json({ escalated: 0, message: 'No stale conversations found' })
  }

  // Get the tenant owner WhatsApp numbers in one query
  const tenantIds = [...new Set(staleConvs.map((c) => c.tenant_id))]
  const { data: tenants } = await supabaseAdmin
    .from('tenants')
    .select('id, name, whatsapp_number')
    .in('id', tenantIds)

  const tenantMap = Object.fromEntries((tenants || []).map((t) => [t.id, t]))

  let escalated = 0

  for (const conv of staleConvs) {
    try {
      // Mark as escalated
      await supabaseAdmin
        .from('conversations')
        .update({ status: 'escalated' })
        .eq('id', conv.id)

      // Notify tenant owner via WhatsApp if configured
      const tenant = tenantMap[conv.tenant_id]
      if (tenant?.whatsapp_number) {
        const contactLabel = conv.contact_name || conv.contact_identifier || 'a contact'
        const hoursOpen    = Math.round((Date.now() - new Date(conv.updated_at).getTime()) / 3_600_000)
        await sendWhatsApp({
          to: tenant.whatsapp_number,
          message: `[AdminOS Alert] A conversation with ${contactLabel} (${conv.intent || 'general inquiry'}) has been open for ${hoursOpen} hours. It has been flagged for your attention. Review it in your dashboard: adminos.co.za/dashboard/inbox`,
        }).catch((err) => console.error('[Escalation Cron] WhatsApp notify failed:', err))
      }

      await writeAuditLog({
        tenantId: conv.tenant_id,
        actor:    'system',
        action:   'conversation.auto_escalated',
        metadata: { conversationId: conv.id, hoursOpen: 48 },
      })

      escalated++
    } catch (err) {
      console.error('[Escalation Cron] Failed for conversation', conv.id, err)
    }
  }

  return NextResponse.json({ escalated, total: staleConvs.length })
}
