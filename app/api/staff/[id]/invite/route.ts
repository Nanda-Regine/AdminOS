import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { withRoute, unwrap, notFound, badRequest } from '@/lib/api/withRoute'
import { generateInviteCode, hashInviteCode, waDigits, INVITE_TTL_DAYS } from '@/lib/people/invites'

const APP_URL = process.env.NEXT_PUBLIC_APP_DOWNLOAD_URL ?? 'https://adminos.co.za/app'

// POST /api/staff/[id]/invite — issue a one-time staff-app invite code.
//
// HR only (staff.write). Any earlier unused code for this employee is revoked,
// so only the newest message works. For an employee who already has a login,
// redeeming the code resets their password — the recovery path for staff
// with no email address.
export const POST = withRoute({
  action: 'staff.write',
  audit: 'staff.invite_issued',
  resourceType: 'staff',
  rateLimit: 'api',
}, async ({ ctx, params }) => {
  if (!z.string().uuid().safeParse(params.id).success) throw notFound('Staff member not found')
  const staff = unwrap(await supabaseAdmin
    .from('staff')
    .select('id, full_name, phone, user_id, active')
    .eq('id', params.id)
    .eq('tenant_id', ctx.tenantId)
    .is('deleted_at', null)
    .maybeSingle())
  if (!staff) throw notFound('Staff member not found')
  if (staff.active === false) throw badRequest('This staff member is inactive — reactivate them before sending an app invite.')

  const now = new Date()
  unwrap(await supabaseAdmin
    .from('staff_invites')
    .update({ revoked_at: now.toISOString() })
    .eq('tenant_id', ctx.tenantId)
    .eq('staff_id', staff.id)
    .is('used_at', null)
    .is('revoked_at', null))

  const code = generateInviteCode()
  const expiresAt = new Date(now.getTime() + INVITE_TTL_DAYS * 86_400_000)
  unwrap(await supabaseAdmin.from('staff_invites').insert({
    tenant_id:  ctx.tenantId,
    staff_id:   staff.id,
    code_hash:  hashInviteCode(code),
    created_by: ctx.userId,
    expires_at: expiresAt.toISOString(),
  }))

  const { data: tenant } = await supabaseAdmin.from('tenants').select('name').eq('id', ctx.tenantId).maybeSingle()
  const first = String(staff.full_name ?? '').split(/\s+/)[0] || 'there'
  const business = tenant?.name ?? 'your employer'
  const resetting = Boolean(staff.user_id)
  const message = resetting
    ? `Hi ${first}, here is a new AdminOS code to get back into your account at ${business}: ${code}\nOpen the AdminOS app, tap "I have an invite code", enter the code and choose a new password. It works once and expires in ${INVITE_TTL_DAYS} days.`
    : `Hi ${first}, ${business} uses AdminOS for payslips, leave and clock-in.\n1. Install the app: ${APP_URL}\n2. Tap "I have an invite code"\n3. Enter: ${code}\nThe code works once and expires in ${INVITE_TTL_DAYS} days.`

  const digits = waDigits(staff.phone as string | null)
  return {
    code,
    expiresAt: expiresAt.toISOString(),
    staffName: staff.full_name,
    resetsExistingLogin: resetting,
    message,
    whatsappUrl: digits ? `https://wa.me/${digits}?text=${encodeURIComponent(message)}` : null,
  }
})
