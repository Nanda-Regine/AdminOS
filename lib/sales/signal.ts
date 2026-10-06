/**
 * Sales / customer intelligence — the pipeline, who's unhappy, who's going cold.
 * Same vertical-slice contract. Outcome: win more quotes, no lead dropped, retention.
 */

import { supabaseAdmin } from '@/lib/supabase/admin'
import { publishSignal, type SalesSignal } from '@/lib/signals/bus'
import { allRows } from '@/lib/supabase/fetchAll'

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
    // Top 2000 by spend. A plain .limit(2000) was silently cut to 1000 by PostgREST's max_rows.
    allRows((lo, hi) => lo >= 2000 ? Promise.resolve({ data: [], error: null })
      : supabaseAdmin.from('contacts').select('id, full_name, contact_type, total_paid, last_contacted_at, phone, wa_id').is('deleted_at', null).eq('tenant_id', tenantId).order('total_paid', { ascending: false }).order('id').range(lo, Math.min(hi, 1999))),
    allRows((lo, hi) => supabaseAdmin.from('invoices').select('amount, amount_paid, status').is('deleted_at', null).eq('tenant_id', tenantId).neq('status', 'paid').order('id').range(lo, hi)),
  ])

  const conversations = convRes.data ?? []
  const contacts = contactRes.data ?? []
  const invoices = invRes.data ?? []

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
    .sort((a, b) => Number(b.total_paid || 0) - Number(a.total_paid || 0))
    .slice(0, 6)
    .map(c => ({
      id: c.id,
      name: c.full_name || '(unnamed)',
      lastContacted: c.last_contacted_at,
      value: Number(c.total_paid || 0),
      phone: (c.phone || c.wa_id) ?? null,
    }))

  const lifetimeRevenue = contacts.reduce((s, c) => s + Number(c.total_paid || 0), 0)
  const pipelineValue = invoices.reduce((s, i) => s + Math.max(0, Number(i.amount || 0) - Number(i.amount_paid || 0)), 0)

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
