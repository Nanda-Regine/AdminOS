import { supabaseAdmin } from '@/lib/supabase/admin'

export async function upsertContact(params: {
  tenantId: string
  identifier: string
  name?: string | null
  phone?: string | null
  email?: string | null
  type?: 'client' | 'supplier' | 'staff' | 'unknown'
  sentiment?: string | null
}) {
  const { tenantId, identifier, name, phone, email, type = 'client', sentiment } = params

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
  if (name) updates.name = name
  if (phone) updates.phone = phone
  if (email) updates.email = email
  if (sentiment) updates.sentiment = sentiment

  const { data, error } = await supabaseAdmin
    .from('contacts')
    .upsert(
      {
        tenant_id: tenantId,
        identifier,
        name: name || identifier,
        phone: phone || null,
        email: email || null,
        type,
        sentiment: sentiment || null,
        tags: [],
      },
      {
        onConflict: 'tenant_id,identifier',
        ignoreDuplicates: false,
      }
    )
    .select('id')
    .single()

  if (error) {
    // If upsert fails (e.g. no unique constraint yet), try update-or-insert manually
    const { data: existing } = await supabaseAdmin
      .from('contacts')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('identifier', identifier)
      .single()

    if (existing) {
      await supabaseAdmin
        .from('contacts')
        .update(updates)
        .eq('tenant_id', tenantId)
        .eq('identifier', identifier)
      return existing.id as string
    }

    const { data: inserted } = await supabaseAdmin
      .from('contacts')
      .insert({
        tenant_id: tenantId,
        identifier,
        name: name || identifier,
        phone: phone || null,
        email: email || null,
        type,
        sentiment: sentiment || null,
        tags: [],
      })
      .select('id')
      .single()

    return inserted?.id as string | undefined
  }

  return data?.id as string | undefined
}
