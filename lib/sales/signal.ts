/**
 * Sales / customer intelligence — the pipeline, who's unhappy, who's going cold.
 * Same vertical-slice contract. Outcome: win more quotes, no lead dropped, retention.
 */

import { supabaseAdmin } from '@/lib/supabase/admin'
import { publishSignal, type SalesSignal } from '@/lib/signals/bus'
import { allRows } from '@/lib/supabase/fetchAll'
import { COUNTED_INVOICE_STATUSES, summariseContactMoney, type MoneyInvoice } from '@/lib/contacts/money'
import { isOwed, outstanding } from '@/lib/invoices/status'

export interface AttentionConvo { name: string; sentiment: string; when: string }
export interface StaleContact { id: string; name: string; lastContacted: string | null; value: number; phone: string | null }

export interface SalesIntel {
  signal: SalesSignal
  openConversations: number
  needAttention: number
  attentionList: AttentionConvo[]
  totalContacts: number
  staleContacts: StaleContact[]   // not contacted in 30+ days
  lifetimeRevenue: number
  pipelineValue: number           // money won, awaiting collection
}

export async function buildSalesIntel(tenantId: string): Promise<SalesIntel> {
  const cutoff = new Date(Date.now() - 30 * 86400000).toISOString()

  const [convRes, contactRes, invRes] = await Promise.all([
    supabaseAdmin.from('conversations').select('contact_name, sentiment, status, updated_at').eq('tenant_id', tenantId).eq('status', 'open').order('updated_at', { ascending: false }),
    // Up to 2000 contacts. A plain .limit(2000) was silently cut to 1000 by PostgREST's max_rows.
    allRows((lo, hi) => lo >= 2000 ? Promise.resolve({ data: [], error: null })
      : supabaseAdmin.from('contacts').select('id, full_name, contact_type, last_contacted_at, phone, wa_id').is('deleted_at', null).eq('tenant_id', tenantId).order('id').range(lo, Math.min(hi, 1999))),
    // Every issued, non-voided invoice: money won (paid) and money still to collect (owed) both come from here.
    allRows<MoneyInvoice>((lo, hi) => supabaseAdmin.from('invoices').select('contact_id, contact_phone, amount, amount_paid, status').is('deleted_at', null).eq('tenant_id', tenantId).in('status', [...COUNTED_INVOICE_STATUSES]).order('id').range(lo, hi)),
  ])

  const conversations = convRes.data ?? []
  const contacts = contactRes.data ?? []
  const invoices = invRes.data ?? []
  // contacts.total_paid has no writer and disagrees with the invoices; derive per-contact revenue instead.
  const money = summariseContactMoney(invoices, contacts.map(c => ({ id: c.id, phone: c.phone })))

  const attentionRows = conversations.filter(c => c.sentiment === 'negative' || c.sentiment === 'urgent')
  const attentionList: AttentionConvo[] = attentionRows.slice(0, 6).map(c => ({
    name: c.contact_name || 'Unknown',
    sentiment: c.sentiment || 'negative',
    when: c.updated_at ? new Date(c.updated_at).toLocaleDateString('en-ZA', { timeZone: 'Africa/Johannesburg', day: 'numeric', month: 'short' }) : '',
  }))

  // Stale = clients/leads not contacted in 30+ days, most valuable first.
  const staleContacts: StaleContact[] = contacts
    .filter(c => !c.last_contacted_at || c.last_contacted_at < cutoff)
    .filter(c => (c.contact_type ?? 'unknown') !== 'staff' && (c.contact_type ?? 'unknown') !== 'supplier')
    .sort((a, b) => (money.get(b.id)?.paid ?? 0) - (money.get(a.id)?.paid ?? 0))
    .slice(0, 6)
    .map(c => ({
      id: c.id,
      name: c.full_name || '(unnamed)',
      lastContacted: c.last_contacted_at,
      value: money.get(c.id)?.paid ?? 0,
      phone: (c.phone || c.wa_id) ?? null,
    }))

  // Everything actually received, including walk-in cash sales that belong to no contact.
  const lifetimeRevenue = invoices.reduce((s, i) => s + Number(i.amount_paid || 0), 0)
  // Money won but not yet collected: only invoices that are really owed (not draft / cancelled / paid).
  const pipelineValue = invoices.filter(i => isOwed(i.status)).reduce((s, i) => s + outstanding(i), 0)

  const signal: SalesSignal = {
    openConversations: conversations.length,
    needAttention: attentionRows.length,
    pipelineValue,
    health: attentionRows.length > 0 ? 'bad' : staleContacts.length > 3 ? 'watch' : 'good',
  }

  return {
    signal, openConversations: conversations.length, needAttention: attentionRows.length, attentionList,
    totalContacts: contacts.length, staleContacts, lifetimeRevenue, pipelineValue,
  }
}

export async function refreshSalesSignal(tenantId: string): Promise<SalesSignal> {
  const intel = await buildSalesIntel(tenantId)
  await publishSignal('sales', tenantId, intel.signal)
  return intel.signal
}
