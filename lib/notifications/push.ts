/**
 * Mobile push — Expo Push API, best-effort and never-throws.
 *
 * Tokens live in `push_tokens` (one row per user × device), registered by the
 * Expo app through POST /api/push/register. Huawei devices without Google Play
 * Services never register a token (FCM is unavailable there), so they rely on
 * the in-app notification list — nothing here needs to special-case them.
 *
 * Expo answers each message with a ticket; `DeviceNotRegistered` means the app
 * was uninstalled or the token rotated, so that token is revoked. Without
 * that, dead tokens accumulate and every send to a churned employee is wasted.
 */

import { supabaseAdmin } from '@/lib/supabase/admin'

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'
const BATCH_SIZE = 100

export interface PushMessage {
  title: string
  body: string
  /** In-app route the app opens when the notification is tapped, e.g. '/leave'. */
  route?: string
  data?: Record<string, unknown>
}

interface ExpoTicket {
  status: 'ok' | 'error'
  message?: string
  details?: { error?: string }
}

/** Push to every registered device of these users, scoped to one tenant. */
export async function pushToUsers(
  tenantId: string,
  userIds: readonly string[],
  msg: PushMessage,
): Promise<{ sent: number; failed: number; total: number }> {
  const result = { sent: 0, failed: 0, total: 0 }
  if (userIds.length === 0) return result
  try {
    const { data: tokens, error } = await supabaseAdmin
      .from('push_tokens')
      .select('token')
      .eq('tenant_id', tenantId)
      .in('user_id', [...new Set(userIds)])
      .is('revoked_at', null)
    if (error || !tokens?.length) return result

    const list = [...new Set(tokens.map((t) => t.token as string))]
    result.total = list.length
    const dead: string[] = []

    for (let i = 0; i < list.length; i += BATCH_SIZE) {
      const batch = list.slice(i, i + BATCH_SIZE)
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(batch.map((to) => ({
          to,
          title: msg.title.slice(0, 150),
          body: msg.body.slice(0, 500),
          sound: 'default',
          channelId: 'default',
          data: { ...(msg.data ?? {}), ...(msg.route ? { route: msg.route } : {}) },
        }))),
      }).catch(() => null)

      if (!res?.ok) { result.failed += batch.length; continue }
      const { data: tickets } = (await res.json().catch(() => ({ data: [] }))) as { data?: ExpoTicket[] }
      ;(tickets ?? []).forEach((t, j) => {
        if (t.status === 'ok') { result.sent++; return }
        result.failed++
        if (t.details?.error === 'DeviceNotRegistered') dead.push(batch[j])
      })
    }

    if (dead.length) {
      // Soft-revoke (Rule #3): kept for the audit trail, never sent to again.
      await supabaseAdmin.from('push_tokens').update({ revoked_at: new Date().toISOString() }).eq('tenant_id', tenantId).in('token', dead)
    }
  } catch (e) {
    console.error('[push] send failed', e)
  }
  return result
}

/**
 * Users in a tenant whose role holds `permission` — the audience for an alert
 * such as "leave request to approve" (approve_leave) or a tenant-level owner
 * alert (view_analytics). Reads the same roles table getContext() does.
 */
export async function usersWithPermission(tenantId: string, permission: string): Promise<string[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('user_roles')
      .select('user_id, roles!inner(permissions)')
      .eq('tenant_id', tenantId)
      .contains('roles.permissions', [permission])
    if (error) return []
    return (data ?? []).map((r) => r.user_id as string)
  } catch {
    return []
  }
}
