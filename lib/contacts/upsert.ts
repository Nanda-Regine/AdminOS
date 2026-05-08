import { supabaseAdmin } from '@/lib/supabase/admin'

export async function upsertContact(params: {
  tenantId:    string
  phone:       string
  fullName?:   string | null
  email?:      string | null
  company?:    string | null
  waId?:       string | null
  source?:     string | null
  externalId?: string | null
  contactType?: 'client' | 'supplier' | 'staff' | 'unknown'
}) {
  const {
    tenantId, phone, fullName, email, company,
    waId, source, externalId, contactType = 'client',
  } = params

  const { data, error } = await supabaseAdmin
    .from('contacts')
    .upsert(
      {
        tenant_id:    tenantId,
        phone,
        full_name:    fullName   ?? null,
        email:        email      ?? null,
        company:      company    ?? null,
        wa_id:        waId       ?? null,
        source:       source     ?? null,
        external_id:  externalId ?? null,
        contact_type: contactType,
        updated_at:   new Date().toISOString(),
      },
      { onConflict: 'tenant_id,phone', ignoreDuplicates: false }
    )
    .select('id')
    .single()

  if (error) throw error
  return data.id as string
}
