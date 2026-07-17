import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { writeAuditLog, getClientIp } from '@/lib/security/audit'
import { seedDefaultRoles, assignRole } from '@/lib/auth/permissions'
import { z } from 'zod'

const schema = z.object({
  name: z.string().min(2).max(100),
  slug: z.string().min(2).max(60).regex(/^[a-z0-9-]+$/),
  ownerEmail: z.string().email(),
  ownerName: z.string().min(1).max(100),
  // Product pricing tiers (see pricing_framework). Matches what the signup and
  // OAuth paths insert; the old starter/growth/enterprise enum was stale.
  plan: z.enum(['solo', 'grow', 'operate', 'scale', 'partner', 'trial']).default('trial'),
  whatsappNumber: z.string().optional(),
  wabaId: z.string().optional(),
})

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  // Verify against DB admins table — not JWT metadata (users can self-assign user_metadata).
  const { data: adminRecord } = await supabaseAdmin
    .from('admins')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!adminRecord) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  let body: z.infer<typeof schema>
  try {
    body = schema.parse(await request.json())
  } catch (e) {
    return NextResponse.json({ error: 'Invalid request body', detail: e }, { status: 400 })
  }

  // 1. Check slug uniqueness
  const { data: existing } = await supabaseAdmin
    .from('tenants')
    .select('id')
    .eq('slug', body.slug)
    .single()

  if (existing) {
    return NextResponse.json({ error: `Slug "${body.slug}" is already taken` }, { status: 409 })
  }

  // 2. Create tenant record
  const { data: tenant, error: tenantErr } = await supabaseAdmin
    .from('tenants')
    .insert({
      name:            body.name,
      slug:            body.slug,
      plan:            body.plan,
      active:          body.plan !== 'trial',
      whatsapp_number: body.whatsappNumber ?? null,
      waba_id:         body.wabaId ?? null,
      // owner_email lets onboardingSequence address the owner; owner_user_id is
      // filled in after the invite resolves (step 4).
      settings:        { owner_email: body.ownerEmail },
    })
    .select('id')
    .single()

  if (tenantErr || !tenant) {
    return NextResponse.json({ error: 'Failed to create tenant', detail: tenantErr?.message }, { status: 500 })
  }

  // 3. Seed the default roles for this tenant now, before anyone is attached.
  // Permission checks fail closed as of Phase 0: a user with a tenant_id but no
  // user_roles row gets nothing. Seeding is idempotent and tenant-scoped, so it
  // is safe even if the invite below fails and the owner is attached later.
  await seedDefaultRoles(tenant.id)

  // 4. Invite the owner via Supabase Auth (sends a magic-link email).
  //
  // NOTE: inviteUserByEmail's `data` writes to user_metadata, which the user
  // owns and which current_tenant_id() no longer reads (Phase 0). So the invite
  // only carries the display name here; the tenant_id and role — the security
  // claims — are written to app_metadata in a follow-up updateUserById once we
  // have the new user's id. Putting tenant_id in the invite `data` is exactly
  // the bug Phase 0 fixed: the owner would sign in resolving a NULL tenant.
  const { data: inviteData, error: inviteErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(
    body.ownerEmail,
    {
      data: { full_name: body.ownerName },
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
    }
  )

  if (inviteErr || !inviteData.user) {
    // Tenant created (with roles seeded) but no owner attached. The operator can
    // re-invite; the invite will then need to run the app_metadata + owner-role
    // steps below. Surface this clearly rather than pretending it succeeded.
    return NextResponse.json({
      tenant,
      warning: `Tenant created but owner invite failed: ${inviteErr?.message ?? 'unknown error'}. Re-invite ${body.ownerEmail}.`,
    }, { status: 201 })
  }

  const ownerId = inviteData.user.id

  // 5. Grant ownership and write the security claims to app_metadata.
  await assignRole({ userId: ownerId, tenantId: tenant.id, roleName: 'owner' })

  await supabaseAdmin.auth.admin.updateUserById(ownerId, {
    // Security claims: app_metadata only (service-role writable). Never the
    // invite `data` / user_metadata.
    app_metadata: {
      tenant_id: tenant.id,
      role: 'owner',
    },
  })

  // Record who the owner is, for onboardingSequence and support lookups.
  await supabaseAdmin
    .from('tenants')
    .update({ settings: { owner_email: body.ownerEmail, owner_user_id: ownerId } })
    .eq('id', tenant.id)

  await writeAuditLog({
    actor:        user.id,
    action:       'admin.tenant.created',
    resourceType: 'tenant',
    resourceId:   tenant.id,
    ipAddress:    getClientIp(request),
    metadata:     { name: body.name, slug: body.slug, plan: body.plan, ownerEmail: body.ownerEmail },
  })

  return NextResponse.json({
    tenant,
    owner: { email: body.ownerEmail, userId: ownerId },
    message: `Tenant created and invite sent to ${body.ownerEmail}`,
  }, { status: 201 })
}
