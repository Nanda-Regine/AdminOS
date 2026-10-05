import { NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { checkRateLimit } from '@/lib/security/rateLimit'
import { writeAuditLog, getClientIp } from '@/lib/security/audit'
import { seedDefaultRoles } from '@/lib/auth/permissions'
import { isRoleName, type RoleName } from '@/lib/auth/roleMatrix'
import { normaliseInviteCode, hashInviteCode, generatedLoginEmail, passwordProblem } from '@/lib/people/invites'
import { notifyTenant } from '@/lib/notifications/notify'

// POST /api/auth/invite/redeem — public (no session yet): turn an invite code
// into a working staff-app login.
//
//   new employee      → creates the auth user (no email confirmation needed —
//                       the employer vouched by sending the code), links
//                       staff.user_id, grants the tenant role
//   already has login → resets that login's password (account recovery)
//
// Every failure that depends on the code says the same thing, so the endpoint
// can't be used to probe which codes exist. Rate-limited per IP.

const schema = z.object({
  code:     z.string().min(8).max(20),
  password: z.string().min(1).max(200),
  email:    z.string().trim().toLowerCase().email().max(200).optional().or(z.literal('').transform(() => undefined)),
})

const INVALID = 'That code is not valid or has expired. Ask your employer to send a new one.'

function fail(status: number, error: string, code: string) {
  return NextResponse.json({ error, code }, { status })
}

export async function POST(request: Request) {
  const ip = getClientIp(request)
  const { success } = await checkRateLimit('onboarding', `invite:${ip}`)
  if (!success) return fail(429, 'Too many attempts. Please wait an hour and try again.', 'rate_limited')

  const parsed = schema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return fail(400, 'Enter your code and a password.', 'bad_request')
  const body = parsed.data

  const code = normaliseInviteCode(body.code)
  if (!code) return fail(400, INVALID, 'invalid_code')
  const pwProblem = passwordProblem(body.password)
  if (pwProblem) return fail(400, pwProblem, 'weak_password')

  const nowIso = new Date().toISOString()
  const { data: invite } = await supabaseAdmin
    .from('staff_invites')
    .select('id, tenant_id, staff_id, created_by')
    .eq('code_hash', hashInviteCode(code))
    .is('used_at', null)
    .is('revoked_at', null)
    .gt('expires_at', nowIso)
    .maybeSingle()
  if (!invite) return fail(400, INVALID, 'invalid_code')

  const { data: staff } = await supabaseAdmin
    .from('staff')
    .select('id, full_name, email, role, user_id, active')
    .eq('id', invite.staff_id)
    .eq('tenant_id', invite.tenant_id)
    .is('deleted_at', null)
    .maybeSingle()
  if (!staff || staff.active === false) return fail(400, INVALID, 'invalid_code')

  // Claim the code first (compare-and-swap) so two simultaneous redemptions
  // can't both succeed. Released again if anything below fails.
  const { data: claimed } = await supabaseAdmin
    .from('staff_invites')
    .update({ used_at: nowIso })
    .eq('id', invite.id)
    .is('used_at', null)
    .select('id')
    .maybeSingle()
  if (!claimed) return fail(400, INVALID, 'invalid_code')
  const release = () => supabaseAdmin.from('staff_invites').update({ used_at: null }).eq('id', invite.id)

  try {
    // ── Recovery: the employee already has a login ─────────────────────────
    if (staff.user_id) {
      const { data: existing, error } = await supabaseAdmin.auth.admin.updateUserById(staff.user_id, { password: body.password })
      if (error || !existing.user) { await release(); return fail(500, 'Could not reset your password. Please try again.', 'internal') }
      await supabaseAdmin.from('staff_invites').update({ used_by: staff.user_id }).eq('id', invite.id)
      await writeAuditLog({
        tenantId: invite.tenant_id, actor: staff.user_id, action: 'staff.login_reset_by_invite',
        resourceType: 'staff', resourceId: staff.id, ipAddress: ip,
      })
      return NextResponse.json({ ok: true, loginEmail: existing.user.email, reset: true })
    }

    // ── New login ──────────────────────────────────────────────────────────
    // Owner is never granted through an invite; anything that isn't a known
    // role (staff.role was free text before Phase 1) becomes 'staff'.
    const role: RoleName = isRoleName(staff.role) && staff.role !== 'owner' && staff.role !== 'client'
      ? staff.role
      : 'staff'
    const email = body.email ?? generatedLoginEmail(String(staff.full_name ?? 'staff'))

    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: body.password,
      email_confirm: true,
      app_metadata: { tenant_id: invite.tenant_id, role },
      user_metadata: { full_name: staff.full_name },
    })
    if (createErr || !created.user) {
      await release()
      const taken = /already|registered|exists/i.test(createErr?.message ?? '')
      return taken
        ? fail(409, 'That email already has an AdminOS login. Sign in with it, or leave the email blank to get a staff login.', 'email_taken')
        : fail(500, 'Could not create your login. Please try again.', 'internal')
    }
    const userId = created.user.id

    // Link the staff row — only if still unlinked (another redemption could
    // not have won the claim above, but HR might have linked it manually).
    const { data: linked } = await supabaseAdmin
      .from('staff')
      .update({ user_id: userId, ...(body.email && !staff.email ? { email: body.email } : {}) })
      .eq('id', staff.id)
      .eq('tenant_id', invite.tenant_id)
      .is('user_id', null)
      .select('id')
      .maybeSingle()
    if (!linked) {
      // Roll back the login we just created: it belongs to no one. This is the
      // only path that removes an auth user, and only one born a moment ago.
      await supabaseAdmin.auth.admin.deleteUser(userId)
      await release()
      return fail(409, 'This staff record was linked to another login just now. Ask your employer for a new code.', 'conflict')
    }

    // Tenant role: withRoute fails closed without a user_roles row.
    let { data: roleRow } = await supabaseAdmin
      .from('roles').select('id').eq('tenant_id', invite.tenant_id).eq('name', role).maybeSingle()
    if (!roleRow) {
      await seedDefaultRoles(invite.tenant_id)
      ;({ data: roleRow } = await supabaseAdmin
        .from('roles').select('id').eq('tenant_id', invite.tenant_id).eq('name', role).maybeSingle())
    }
    if (roleRow) {
      await supabaseAdmin.from('user_roles').upsert({
        user_id: userId, tenant_id: invite.tenant_id, role_id: roleRow.id, assigned_by: invite.created_by,
      }, { onConflict: 'user_id, tenant_id' })
    }

    await supabaseAdmin.from('staff_invites').update({ used_by: userId }).eq('id', invite.id)
    await writeAuditLog({
      tenantId: invite.tenant_id, actor: userId, action: 'staff.invite_redeemed',
      resourceType: 'staff', resourceId: staff.id, metadata: { role, generatedLogin: !body.email }, ipAddress: ip,
    })
    await notifyTenant(invite.tenant_id, {
      type: 'staff_joined_app',
      title: 'Joined the staff app',
      body: `${staff.full_name} can now see their payslips, request leave and clock in from their phone.`,
      actionUrl: `/dashboard/staff/${staff.id}`,
    })

    return NextResponse.json({ ok: true, loginEmail: email, generatedLogin: !body.email }, { status: 201 })
  } catch (e) {
    console.error('[invite/redeem]', e)
    await release()
    return fail(500, 'Something went wrong. Please try again.', 'internal')
  }
}
