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

  const tenantId = user.app_metadata?.tenant_id as string
  const body = await request.json()

  const {
    name, businessType, country, language, timezone, whatsappNumber, faqs, policies, tone, services,
    address, vatNumber, bankName, bankAccountHolder, bankAccountNumber, bankBranchCode,
  } = body

  // Build updated settings
  const { data: existing } = await supabaseAdmin
    .from('tenants')
    .select('settings')
    .eq('id', tenantId)
    .single()

  // Only overwrite settings keys the caller actually sent — this route is
  // called with partial bodies (e.g. onboarding completion only sends
  // name + businessType), and unconditionally defaulting an omitted field
  // to '' silently wiped any previously-configured bot training content.
  const existingSettings = existing?.settings || {}
  const updatedSettings = {
    ...existingSettings,
    faqs: faqs !== undefined ? faqs : (existingSettings.faqs ?? ''),
    policies: policies !== undefined ? policies : (existingSettings.policies ?? ''),
    tone: tone !== undefined ? tone : (existingSettings.tone ?? 'warm'),
    services: services !== undefined ? services : (existingSettings.services ?? ''),
    address: address !== undefined ? address : (existingSettings.address ?? ''),
    vat_number: vatNumber !== undefined ? vatNumber : (existingSettings.vat_number ?? ''),
    bank_name: bankName !== undefined ? bankName : (existingSettings.bank_name ?? ''),
    bank_account_holder: bankAccountHolder !== undefined ? bankAccountHolder : (existingSettings.bank_account_holder ?? ''),
    bank_account_number: bankAccountNumber !== undefined ? bankAccountNumber : (existingSettings.bank_account_number ?? ''),
    bank_branch_code: bankBranchCode !== undefined ? bankBranchCode : (existingSettings.bank_branch_code ?? ''),
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
