import { supabaseAdmin } from '@/lib/supabase/admin'
import { allRows } from '@/lib/supabase/fetchAll'
import {
  COUNTED_INVOICE_STATUSES, summariseContactMoney,
  type ContactMoney, type MoneyContact, type MoneyInvoice,
} from '@/lib/contacts/money'

/** Per-contact invoiced / paid / owed for a whole tenant. Pages through every invoice (1000-row cap). */
export async function contactMoneyForTenant(tenantId: string, contacts: readonly MoneyContact[]): Promise<Map<string, ContactMoney>> {
  const { data, error } = await allRows<MoneyInvoice>((lo, hi) =>
    supabaseAdmin
      .from('invoices')
      .select('contact_id, contact_phone, amount, amount_paid, status')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .in('status', [...COUNTED_INVOICE_STATUSES])
      .order('id')
      .range(lo, hi))
  if (error) throw new Error(`contact money: ${error.message}`)
  return summariseContactMoney(data ?? [], contacts)
}

export interface ContactInvoiceRow extends MoneyInvoice {
  id: string
  invoice_number: string | null
  due_date: string | null
  created_at: string
}

/**
 * Every invoice that belongs to one contact, newest first: those linked by contact_id, plus
 * (only for invoices with no contact_id) those whose phone matches. The old profile query matched
 * on phone alone, so a contact with a blank phone matched every blank-phone invoice in the tenant.
 */
export async function invoicesForContact(tenantId: string, contact: MoneyContact): Promise<ContactInvoiceRow[]> {
  const page = (lo: number, hi: number) => supabaseAdmin
    .from('invoices')
    .select('id, invoice_number, contact_id, contact_phone, amount, amount_paid, status, due_date, created_at')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .in('status', [...COUNTED_INVOICE_STATUSES])
    .order('created_at', { ascending: false })
    .order('id')
    .range(lo, hi)

  const byId = await allRows<ContactInvoiceRow>((lo, hi) => page(lo, hi).eq('contact_id', contact.id))
  if (byId.error) throw new Error(`contact invoices: ${byId.error.message}`)
  let rows = byId.data ?? []

  const phone = (contact.phone ?? '').trim()
  if (phone) {
    const byPhone = await allRows<ContactInvoiceRow>((lo, hi) => page(lo, hi).is('contact_id', null).eq('contact_phone', phone))
    if (byPhone.error) throw new Error(`contact invoices: ${byPhone.error.message}`)
    rows = [...rows, ...(byPhone.data ?? [])]
  }
  return rows.sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0))
}
