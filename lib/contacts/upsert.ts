import { supabaseAdmin } from '@/lib/supabase/admin'
import { phoneLikePattern, samePhone, toE164 } from '@/lib/contacts/phone'

/**
 * Find-or-create a contact by (tenant, phone).
 *
 * Not a PostgREST upsert, deliberately. `contacts_tenant_phone_unique` is
 * DEFERRABLE, and Postgres refuses deferrable constraints as ON CONFLICT
 * arbiters — the old `.upsert(..., { onConflict: 'tenant_id,phone' })` failed on
 * every call (verified live 2026-10-06), so no inbound WhatsApp sender and no
 * public booking ever produced a contact. An upsert also overwrote an existing
 * contact's name/email/type with whatever the caller passed, including null.
 *
 * Here:
 *   - an existing row is only filled in, never blanked — a field is written
 *     only when the caller supplies a value and the row has none (name, email,
 *     company), or always for routing ids (wa_id) that must stay current;
 *   - a soft-deleted match is revived (the phone is still unique-held by it, so
 *     inserting a new row would 23505), because the person is back in touch;
 *   - a concurrent insert of the same phone (two messages in the same second)
 *     loses the race with 23505 and re-reads the winner's row.
 */
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
}): Promise<string> {
  const {
    tenantId, phone, fullName, email, company,
    waId, source, externalId, contactType = 'client',
  } = params

  // Match by phone identity, not string: "+27 82 345 6789", "0823456789" and
  // WhatsApp's "27823456789" are one person (see lib/contacts/phone.ts).
  // Prefer a live row over a soft-deleted one when both exist.
  const find = async () => {
    const pattern = phoneLikePattern(phone)
    if (!pattern) return { data: null, error: null }
    const { data, error } = await supabaseAdmin
      .from('contacts')
      .select('id, phone, full_name, email, company, wa_id, deleted_at')
      .eq('tenant_id', tenantId)
      .like('phone', pattern)
      .order('deleted_at', { ascending: false, nullsFirst: true })
      .limit(10)
    if (error) return { data: null, error }
    return { data: (data ?? []).find(r => samePhone(r.phone, phone)) ?? null, error: null }
  }

  const fillIn = async (row: { id: string; full_name: string | null; email: string | null; company: string | null; wa_id: string | null; deleted_at: string | null }) => {
    const patch: Record<string, unknown> = {}
    if (fullName && !row.full_name) patch.full_name = fullName
    if (email && !row.email)        patch.email = email
    if (company && !row.company)    patch.company = company
    if (waId && row.wa_id !== waId) patch.wa_id = waId
    if (row.deleted_at)             patch.deleted_at = null
    if (Object.keys(patch).length) {
      patch.updated_at = new Date().toISOString()
      const { error } = await supabaseAdmin.from('contacts').update(patch).eq('id', row.id).eq('tenant_id', tenantId)
      if (error) throw error
    }
    return row.id
  }

  const { data: existing, error: findError } = await find()
  if (findError) throw findError
  if (existing) return fillIn(existing)

  const { data, error } = await supabaseAdmin
    .from('contacts')
    .insert({
      tenant_id:    tenantId,
      phone:        toE164(phone),
      full_name:    fullName   ?? null,
      email:        email      ?? null,
      company:      company    ?? null,
      wa_id:        waId       ?? null,
      source:       source     ?? null,
      external_id:  externalId ?? null,
      contact_type: contactType,
    })
    .select('id')
    .single()

  if (error) {
    if ((error as { code?: string }).code === '23505') {
      const { data: winner } = await find()
      if (winner) return fillIn(winner)
    }
    throw error
  }
  return data.id as string
}
