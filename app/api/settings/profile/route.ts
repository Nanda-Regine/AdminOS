import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { buildCachedSystemPrompt } from '@/lib/ai/buildSystemPrompt'
import { writeAuditLog } from '@/lib/security/audit'
import { Tenant } from '@/types/database'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.user_metadata?.tenant_id as string
  const body = await request.json()

  const { name, businessType, country, language, timezone, whatsappNumber, faqs, policies, tone, services } = body

  // Build updated settings
  const { data: existing } = await supabaseAdmin
    .from('tenants')
    .select('settings')
    .eq('id', tenantId)
    .single()

  const updatedSettings = {
    ...(existing?.settings || {}),
    faqs: faqs || '',
    policies: policies || '',
    tone: tone || 'warm',
    services: services || '',
  }

  const { data: updatedTenant, error } = await supabaseAdmin
    .from('tenants')
    .update({
      name: name || undefined,
      business_type: businessType || undefined,
      country: country || undefined,
      language_primary: language || undefined,
      timezone: timezone || undefined,
      whatsapp_number: whatsappNumber || undefined,
      settings: updatedSettings,
    })
    .eq('id', tenantId)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  // Rebuild system prompt cache
  const systemPrompt = await buildCachedSystemPrompt(updatedTenant as Tenant)
  await supabaseAdmin
    .from('tenants')
    .update({
      system_prompt_cache: systemPrompt,
      prompt_cached_at: new Date().toISOString(),
    })
    .eq('id', tenantId)

  await writeAuditLog({
    tenantId,
    actor: user.id,
    action: 'tenant.settings.updated',
  })

  return NextResponse.json({ success: true })
}
