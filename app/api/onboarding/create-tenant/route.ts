import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { buildCachedSystemPrompt } from '@/lib/ai/buildSystemPrompt'
import { Tenant } from '@/types/database'

export async function POST(request: Request) {
  const body = await request.json()
  const { userId, businessName, email } = body

  if (!userId || !businessName) {
    return new NextResponse('Missing required fields', { status: 400 })
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
      plan: 'starter',
      country: 'ZA',
      language_primary: 'en',
      timezone: 'Africa/Johannesburg',
      settings: {},
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

  // Update user metadata with tenant_id
  await supabaseAdmin.auth.admin.updateUserById(userId, {
    user_metadata: {
      tenant_id: tenant.id,
      role: 'admin',
      onboarding_completed: false,
      onboarding_step: 0,
    },
  })

  // Write audit log
  await supabaseAdmin.from('audit_log').insert({
    tenant_id: tenant.id,
    actor: userId,
    action: 'tenant.created',
    metadata: { businessName, email },
  })

  return NextResponse.json({ tenantId: tenant.id, slug })
}
