import { supabaseAdmin } from '@/lib/supabase/admin'
import { fetchAll } from '@/lib/supabase/fetchAll'
import { phoneDigits, phoneLikePattern } from '@/lib/contacts/phone'
import { mayMarketTo, dedupeByPhone, type MarketingContact } from '@/lib/reach/consent'

export interface AudienceFilter { contact_type?: string[] }

export interface Recipient extends MarketingContact { id: string; phone: string; full_name: string | null }

/**
 * Everyone a campaign's filter selects, split into who may be messaged under
 * POPIA s69 and how many were held back. Paged (fetchAll): the old send query
 * stopped at PostgREST's 1000-row cap, so a big list was silently cut short.
 */
export async function resolveAudience(tenantId: string, filter: AudienceFilter) {
  const rows = await fetchAll<Recipient>((from, to) => {
    let q = supabaseAdmin
      .from('contacts')
      .select('id, phone, full_name, contact_type, popia_consent, marketing_opt_out_at')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .not('phone', 'is', null)
      .neq('phone', '')
    if (filter.contact_type?.length) q = q.in('contact_type', filter.contact_type)
    return q.order('id').range(from, to)
  })

  const selected = dedupeByPhone(rows, phoneDigits)
  const eligible = selected.filter(mayMarketTo)
  return {
    eligible,
    selected: selected.length,
    optedOut: selected.filter((c) => c.marketing_opt_out_at).length,
    noConsent: selected.filter((c) => !c.marketing_opt_out_at && !mayMarketTo(c)).length,
  }
}

/** Is this phone allowed to receive marketing from this tenant right now? (sequences) */
export async function phoneMayBeMarketed(tenantId: string, phone: string): Promise<boolean> {
  const digits = phoneDigits(phone), tail = phoneLikePattern(phone)
  if (!digits || !tail) return false
  const { data } = await supabaseAdmin
    .from('contacts')
    .select('phone, contact_type, popia_consent, marketing_opt_out_at')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .like('phone', tail)
    .limit(20)
  const matches = (data ?? []).filter((c) => phoneDigits(c.phone) === digits)
  // An objection on any copy of this person wins.
  if (matches.some((c) => c.marketing_opt_out_at)) return false
  return matches.some(mayMarketTo)
}

/**
 * Record an objection (STOP reply, or the business recording it). Matches the
 * person however their number was stored. Returns how many contact rows changed.
 */
export async function recordOptOut(tenantId: string, phone: string): Promise<number> {
  const digits = phoneDigits(phone), tail = phoneLikePattern(phone)
  if (!digits || !tail) return 0
  const { data } = await supabaseAdmin
    .from('contacts')
    .select('id, phone')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .is('marketing_opt_out_at', null)
    .like('phone', tail)
    .limit(20)
  const ids = (data ?? []).filter((c) => phoneDigits(c.phone) === digits).map((c) => c.id)
  if (!ids.length) return 0
  await supabaseAdmin.from('contacts').update({ marketing_opt_out_at: new Date().toISOString() })
    .eq('tenant_id', tenantId).in('id', ids)
  // Active sequences for this person stop too.
  await supabaseAdmin.from('sequence_enrollments').update({ status: 'cancelled' })
    .eq('tenant_id', tenantId).eq('status', 'active').in('contact_identifier', [phone, `+${digits}`, digits])
  return ids.length
}
