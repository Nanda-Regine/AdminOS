import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { buildCachedSystemPrompt } from '@/lib/ai/buildSystemPrompt'
import { seedDefaultRoles, assignRole } from '@/lib/auth/permissions'
import { Tenant } from '@/types/database'
import { z } from 'zod'

const bodySchema = z.object({
  businessName: z.string().trim().min(1).max(120),
})

/**
 * Provision a tenant for the signed-in user.
 *
 * This route previously took `userId` from the request body and ran no auth
 * check at all, while sitting under middleware's PUBLIC_PREFIXES ('/api/onboarding/').
 * That let an unauthenticated caller create unlimited tenants and overwrite any
 * user's metadata — including re-pointing a victim's tenant_id — just by POSTing
 * their user id. The caller is now taken from the session and the body field is
 * ignored.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  let body: z.infer<typeof bodySchema>
  try {
    body = bodySchema.parse(await request.json())
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const { businessName } = body

  // One tenant per user. Without this, a signed-in user could POST repeatedly
  // and strand orphaned tenants, and re-point their own tenant claim at will.
  if (user.app_metadata?.tenant_id) {
    return NextResponse.json({ error: 'Tenant already provisioned' }, { status: 409 })
  }

  // Generate unique slug
  const baseSlug = businessName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').slice(0, 30)
  const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`

  // Create tenant
  const { data: tenant, error } = await supabaseAdmin
    .from('tenants')
    .insert({
      name: businessName,
      slug,
      plan: 'solo',
      country: 'ZA',
      language_primary: 'en',
      timezone: 'Africa/Johannesburg',
      // owner_user_id is what onboardingSequence reads to assign the owner role.
      // It was never set here, so that step silently no-oped for every tenant.
      settings: { owner_user_id: user.id, owner_email: user.email },
      active: true,
    })
    .select()
    .single()

  if (error || !tenant) {
    console.error('[Create Tenant]', error)
    return new NextResponse('Failed to create tenant', { status: 500 })
  }

  // Build initial system prompt
  const systemPrompt = await buildCachedSystemPrompt(tenant as Tenant)
  await supabaseAdmin
    .from('tenants')
    .update({
      system_prompt_cache: systemPrompt,
      prompt_cached_at: new Date().toISOString(),
    })
    .eq('id', tenant.id)

  // Seed roles and grant ownership BEFORE writing the tenant claim. Permission
  // checks fail closed as of Phase 0 — a tenant_id with no matching user_roles
  // row grants nothing, so a user provisioned without a role would be locked out
  // of the business they just created.
  await seedDefaultRoles(tenant.id)
  await assignRole({ userId: user.id, tenantId: tenant.id, roleName: 'owner' })

  // tenant_id and role are security claims: app_metadata (service-role writable
  // only), never user_metadata (user-writable). Onboarding UI state stays in
  // user_metadata, where a user rewriting it harms nobody.
  await supabaseAdmin.auth.admin.updateUserById(user.id, {
    app_metadata: {
      tenant_id: tenant.id,
      role: 'owner',
    },
    user_metadata: {
      ...user.user_metadata,
      onboarding_completed: false,
      onboarding_step: 0,
    },
  })

  // Write audit log
  await supabaseAdmin.from('audit_log').insert({
    tenant_id: tenant.id,
    actor: user.id,
    action: 'tenant.created',
    metadata: { businessName, email: user.email },
  })

  return NextResponse.json({ tenantId: tenant.id, slug })
}
