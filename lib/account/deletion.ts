import { randomBytes } from 'node:crypto'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { writeAuditLog } from '@/lib/security/audit'
import { notifyTenant } from '@/lib/notifications/notify'

/**
 * Account deletion — Google Play / AppGallery require it in-app and on the web.
 *
 * What "delete my account" means in AdminOS (disclosed on /account/delete):
 *  - Immediately: the login is disabled (banned + suspended), every device
 *    stops receiving pushes, and the login is unlinked from the staff record.
 *  - After 30 days: the login's personal identifiers (email, name, metadata)
 *    are anonymised and its password replaced — the account cannot be
 *    recovered or signed into. Until then support can reverse a mistake.
 *  - Retained: business records the employer must keep by law — payslips,
 *    leave, attendance, invoices (BCEA s31: 3 years; Tax Administration Act
 *    s29: 5 years). They belong to the business, not to the login.
 *
 * An owner deleting their login does not delete the business: that is a
 * separate closure (subscription, data export, retention), so it is flagged
 * for review instead of silently orphaning a tenant.
 */

export const PURGE_DAYS = 30
const BAN_FOREVER = '876000h' // 100 years — GoTrue has no "permanent"

export interface DeletionResult {
  requestId: string
  purgeAfter: string
  alreadyRequested: boolean
}

export async function requestAccountDeletion(input: {
  userId: string
  tenantId: string | null
  role: string | null
  reason?: string
  source: 'app' | 'web'
  ipAddress?: string
}): Promise<DeletionResult> {
  const { userId, tenantId } = input

  const { data: open } = await supabaseAdmin
    .from('account_deletion_requests')
    .select('id, purge_after')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .maybeSingle()

  let requestId = open?.id as string | undefined
  let purgeAfter = open?.purge_after as string | undefined
  if (!requestId) {
    const purge = new Date(Date.now() + PURGE_DAYS * 86_400_000).toISOString()
    const { data, error } = await supabaseAdmin
      .from('account_deletion_requests')
      .insert({
        user_id: userId, tenant_id: tenantId, role: input.role,
        reason: input.reason?.slice(0, 1000) || null, source: input.source, purge_after: purge,
      })
      .select('id, purge_after')
      .single()
    if (error) throw error
    requestId = data.id
    purgeAfter = data.purge_after
  }

  // Disable the login. Spread the current app_metadata rather than trusting the
  // admin update to merge it, so tenant_id/role survive for the audit trail.
  const { data: current } = await supabaseAdmin.auth.admin.getUserById(userId)
  await supabaseAdmin.auth.admin.updateUserById(userId, {
    ban_duration: BAN_FOREVER,
    app_metadata: { ...(current.user?.app_metadata ?? {}), suspended: true, deletion_requested_at: new Date().toISOString() },
  })

  await supabaseAdmin
    .from('push_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('revoked_at', null)

  if (tenantId) {
    await supabaseAdmin.from('staff').update({ user_id: null }).eq('tenant_id', tenantId).eq('user_id', userId)
  }

  await writeAuditLog({
    tenantId: tenantId ?? undefined,
    actor: userId,
    action: 'account.deletion_requested',
    resourceType: 'user',
    resourceId: userId,
    metadata: { role: input.role, source: input.source, purgeAfter },
    ipAddress: input.ipAddress,
    critical: true,
  })

  if (tenantId && !open) {
    const owner = input.role === 'owner'
    await notifyTenant(tenantId, {
      type: 'account_deletion',
      title: owner ? 'Owner account deletion requested' : 'A team member deleted their app login',
      body: owner
        ? 'The owner login was disabled at its holder’s request. The business and its records are unchanged — contact privacy@mirembemuse.co.za to close the business or restore access.'
        : 'Their staff record, payslips and leave history are kept as the law requires; only their login was removed.',
    })
  }

  return { requestId: requestId!, purgeAfter: purgeAfter!, alreadyRequested: Boolean(open) }
}

/** Anonymise one due request's login. Idempotent. */
export async function purgeDeletedAccount(requestId: string, userId: string): Promise<void> {
  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    email: `deleted-${requestId}@deleted.adminos.co.za`,
    password: randomBytes(32).toString('base64url'),
    user_metadata: {},
    ban_duration: BAN_FOREVER,
  })
  // A user already removed from auth (e.g. by an operator) is as purged as it gets.
  if (error && !/not.?found/i.test(error.message)) throw new Error(error.message)

  await supabaseAdmin
    .from('account_deletion_requests')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', requestId)
    .eq('status', 'pending')
}
