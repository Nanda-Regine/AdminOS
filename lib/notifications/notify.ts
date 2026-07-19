/**
 * THE NOTIFICATION SPINE (ported from BB-MotherShip-Deluxe `lib/notifications`).
 *
 * Best-effort, NEVER-THROWS fan-out: writes an in-app `notifications` row and,
 * where a destination is known, mirrors to WhatsApp. A notification failing must
 * never break the primary action that triggered it — every path is guarded.
 *
 * Channels:
 *  - In-app is TENANT-LEVEL (`user_id: null`) — the bell shows it to anyone
 *    logged into that tenant (matches the existing worker convention).
 *  - Owner WhatsApp goes ONLY to `tenants.settings.notify_phone` (never the
 *    customer-facing `whatsapp_number`), and only if the owner has set it.
 *  - Customer WhatsApp goes to the contact's own phone.
 */

import { supabaseAdmin } from '@/lib/supabase/admin'
import { sendWhatsApp } from '@/lib/whatsapp/send'
import { whatsappAllowed, isQuietNow } from '@/lib/notifications/delivery'

export interface NotifyInput {
  tenantId: string
  userId?: string | null
  type: string
  title: string
  body: string
  actionUrl?: string
  data?: Record<string, unknown>
  /** If set, skip when an unread notification with this key exists in the window. */
  dedupeKey?: string
  dedupeHours?: number
  /** Mirror to WhatsApp: an explicit destination + text. */
  whatsapp?: { to: string; text: string }
}

/** Core writer. Returns true if a row was written, false if deduped/failed. */
export async function notify(input: NotifyInput): Promise<boolean> {
  try {
    if (input.dedupeKey) {
      const sinceIso = new Date(Date.now() - (input.dedupeHours ?? 24) * 3600000).toISOString()
      const { data: existing } = await supabaseAdmin
        .from('notifications')
        .select('id')
        .eq('tenant_id', input.tenantId)
        .eq('read', false)
        .contains('data', { dedupe_key: input.dedupeKey })
        .gte('created_at', sinceIso)
        .limit(1)
      if (existing && existing.length > 0) return false
    }

    const { error } = await supabaseAdmin.from('notifications').insert({
      tenant_id: input.tenantId,
      user_id: input.userId ?? null,
      type: input.type,
      title: input.title,
      body: input.body,
      read: false,
      action_url: input.actionUrl ?? null,
      data: { ...(input.data ?? {}), ...(input.dedupeKey ? { dedupe_key: input.dedupeKey } : {}) },
    })
    if (error) { console.error('[notify] insert failed', error.message); return false }

    if (input.whatsapp?.to && isSendableWhatsApp()) {
      await sendWhatsApp({ to: input.whatsapp.to, message: input.whatsapp.text }).catch(() => {})
    }
    return true
  } catch (e) {
    console.error('[notify] unexpected error', e)
    return false
  }
}

/** Owner-facing alert: in-app (tenant-level) + WhatsApp to the owner's notify phone if set. */
export async function notifyTenant(
  tenantId: string,
  n: { type: string; title: string; body: string; actionUrl?: string; data?: Record<string, unknown>; dedupeKey?: string; dedupeHours?: number; whatsapp?: boolean },
): Promise<boolean> {
  let whatsapp: NotifyInput['whatsapp']
  if (n.whatsapp) {
    // One settings read covers the phone AND the owner's delivery controls:
    // a per-type WhatsApp opt-out and quiet hours both gate the mirror. The
    // in-app bell below is always written regardless.
    const settings = await tenantSettings(tenantId)
    const phone = ownerPhoneFrom(settings)
    if (phone && whatsappAllowed(settings, n.type)) whatsapp = { to: phone, text: `${n.title}\n${n.body}` }
  }
  return notify({ tenantId, userId: null, type: n.type, title: n.title, body: n.body, actionUrl: n.actionUrl, data: n.data, dedupeKey: n.dedupeKey, dedupeHours: n.dedupeHours, whatsapp })
}

/** Customer-facing WhatsApp (booking reminder, payment thanks…) to the contact's own phone. */
export async function notifyContact(
  tenantId: string,
  contactId: string,
  n: { type: string; title: string; body: string; text: string; data?: Record<string, unknown>; alsoInApp?: boolean },
): Promise<boolean> {
  try {
    const { data: contact } = await supabaseAdmin
      .from('contacts')
      .select('phone, wa_id, full_name')
      .eq('tenant_id', tenantId)
      .eq('id', contactId)
      .maybeSingle()
    const to = contact?.phone || (contact?.wa_id as string | undefined)
    // Respect the tenant's quiet hours for customer sends too — no 2am pings.
    const settings = await tenantSettings(tenantId)
    if (to && isSendableWhatsApp() && !isQuietNow(settings)) {
      await sendWhatsApp({ to, message: n.text }).catch(() => {})
    }
    if (n.alsoInApp) {
      await notify({ tenantId, type: n.type, title: n.title, body: n.body, data: { ...n.data, contact_id: contactId } })
    }
    return true
  } catch (e) {
    console.error('[notifyContact] error', e)
    return false
  }
}

// ── helpers ──────────────────────────────────────────────────────────────────
function isSendableWhatsApp(): boolean {
  return Boolean(process.env.META_PHONE_NUMBER_ID && process.env.META_WHATSAPP_ACCESS_TOKEN)
}

async function tenantSettings(tenantId: string): Promise<Record<string, unknown>> {
  try {
    const { data } = await supabaseAdmin.from('tenants').select('settings').eq('id', tenantId).maybeSingle()
    return (data?.settings ?? {}) as Record<string, unknown>
  } catch {
    return {}
  }
}

function ownerPhoneFrom(settings: Record<string, unknown>): string | null {
  const phone = settings.notify_phone ?? settings.owner_phone
  return typeof phone === 'string' && phone.trim() ? phone.trim() : null
}
