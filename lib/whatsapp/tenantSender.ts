import { supabaseAdmin } from '@/lib/supabase/admin'
import { sendWhatsAppMessage } from '@/lib/whatsapp/send'

/**
 * Customer-facing WhatsApp goes out AS THE BUSINESS: from the tenant's own
 * connected number when it has one, so the customer sees the salon/clinic and
 * can reply into that business's Inbox (inbound is routed by the receiving
 * number — getTenantByWhatsAppNumber). Only when the tenant hasn't connected a
 * number does it fall back to the shared platform number.
 *
 * `sendWhatsApp()` always used the platform number — right for messages to the
 * owner and staff (lib/notifications), wrong for messages to a business's
 * customers, which is what this is for.
 */
export async function tenantPhoneNumberId(tenantId: string): Promise<string | null> {
  const { data } = await supabaseAdmin.from('tenants').select('meta_phone_number_id').eq('id', tenantId).maybeSingle()
  return (data?.meta_phone_number_id as string | null) ?? process.env.META_PHONE_NUMBER_ID ?? null
}

export async function sendAsTenant(tenantId: string, to: string, message: string, phoneNumberId?: string | null): Promise<{ messageId: string }> {
  const from = phoneNumberId ?? await tenantPhoneNumberId(tenantId)
  if (!from) throw new Error('[WhatsApp] no sending number configured')
  return sendWhatsAppMessage(from, to, message)
}
