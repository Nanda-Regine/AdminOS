import { supabaseAdmin } from '@/lib/supabase/admin'

/**
 * How much of the business a tenant has actually set up. The cockpits' "all
 * smooth" lead is only reassuring for an established tenant — for a brand-new
 * one with zero records it reads as a lie ("the team is running well — 0 active").
 * This gives each cockpit a reliable per-domain "have they started?" signal so it
 * can lead with a setup nudge instead. One batched round-trip (head-only counts).
 */
export interface TenantSetupState {
  contacts:  number
  invoices:  number
  staff:     number
  products:  number
  contracts: number
  /** Nothing set up anywhere — a genuinely new tenant. */
  isNew:     boolean
}

export async function getSetupState(tenantId: string): Promise<TenantSetupState> {
  const count = (table: string) =>
    supabaseAdmin.from(table).select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId)

  const [contacts, invoices, staff, products, contracts] = await Promise.all([
    count('contacts'), count('invoices'), count('staff'), count('products'), count('contracts'),
  ])

  const counts = {
    contacts:  contacts.count  ?? 0,
    invoices:  invoices.count  ?? 0,
    staff:     staff.count     ?? 0,
    products:  products.count  ?? 0,
    contracts: contracts.count ?? 0,
  }
  return { ...counts, isNew: Object.values(counts).every(c => c === 0) }
}
