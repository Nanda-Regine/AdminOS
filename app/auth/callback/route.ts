import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { buildCachedSystemPrompt } from '@/lib/ai/buildSystemPrompt'
import { seedDefaultRoles, assignRole } from '@/lib/auth/permissions'
import { Tenant } from '@/types/database'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=oauth_failed`)
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    return NextResponse.redirect(`${origin}/login?error=oauth_failed`)
  }

  // Get the user after session exchange
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(`${origin}/login?error=oauth_failed`)
  }

  // If this is a new OAuth user (no tenant yet), provision one automatically
  if (!user.app_metadata?.tenant_id) {
    // Email/password signups carry the business name the user actually typed;
    // OAuth signups have no such field, so fall back to deriving one.
    const fullName = user.user_metadata?.full_name || user.user_metadata?.name || ''
    const typedName = (user.user_metadata?.business_name as string | undefined)?.trim()
    const businessName =
      typedName ||
      (fullName ? `${fullName.split(' ')[0]}'s Business` : 'My Business')
    const baseSlug = businessName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').slice(0, 30)
    const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`

    const { data: tenant } = await supabaseAdmin
      .from('tenants')
      .insert({
        name: businessName,
        slug,
        plan: 'solo',
        country: 'ZA',
        language_primary: 'en',
        timezone: 'Africa/Johannesburg',
        settings: { owner_user_id: user.id, owner_email: user.email },
        active: true,
      })
      .select()
      .single()

    if (tenant) {
      const systemPrompt = await buildCachedSystemPrompt(tenant as Tenant)
      await supabaseAdmin
        .from('tenants')
        .update({ system_prompt_cache: systemPrompt, prompt_cached_at: new Date().toISOString() })
        .eq('id', tenant.id)

      // Seed roles and grant ownership BEFORE writing the tenant claim.
      // Permission checks fail closed as of Phase 0: a user holding a tenant_id
      // with no matching user_roles row gets nothing. The onboarding Inngest
      // function also seeds roles, but only on subscription.activated — i.e.
      // after payment — which would lock every new signup out of their own
      // dashboard until they paid. Seeding is idempotent, so both can run.
      await seedDefaultRoles(tenant.id)
      await assignRole({ userId: user.id, tenantId: tenant.id, roleName: 'owner' })

      await supabaseAdmin.auth.admin.updateUserById(user.id, {
        // tenant_id and role are security claims: app_metadata only. The user
        // owns user_metadata and can rewrite it via supabase.auth.updateUser(),
        // so a tenant_id kept there is attacker-controlled.
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

      await supabaseAdmin.from('audit_log').insert({
        tenant_id: tenant.id,
        actor: user.id,
        action: 'tenant.created',
        metadata: { businessName, email: user.email, provider: user.app_metadata?.provider },
      })

      // New users go to onboarding
      return NextResponse.redirect(`${origin}/dashboard/onboarding`)
    }
  }

  return NextResponse.redirect(`${origin}${next}`)
}
