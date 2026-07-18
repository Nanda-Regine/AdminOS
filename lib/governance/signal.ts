/**
 * Governance intelligence — deadlines, contract renewals, business health & worth.
 * Same vertical-slice contract. Outcome: no penalties, investor-ready, know your value.
 */

import { supabaseAdmin } from '@/lib/supabase/admin'
import { publishSignal, type GovernanceSignal } from '@/lib/signals/bus'

export interface Deadline { title: string; dueDate: string | null; daysLeft: number | null; kind: string; penalty: string | null }

export interface GovernanceIntel {
  signal: GovernanceSignal
  deadlines: Deadline[]         // soonest first, ≤60 days
  contractsExpiring: number
  contractsAwaiting: number
  healthScore: number | null
  valuation: number | null
}

const daysUntil = (d: string | null): number | null => {
  if (!d) return null
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000)
}

export async function buildGovernanceIntel(tenantId: string): Promise<GovernanceIntel> {
  const [compRes, contractRes, healthRes, valRes] = await Promise.all([
    supabaseAdmin.from('compliance_items').select('title, due_date, status, item_type, penalty_description').eq('tenant_id', tenantId).neq('status', 'completed'),
    supabaseAdmin.from('contracts').select('status, end_date').eq('tenant_id', tenantId),
    supabaseAdmin.from('business_health_snapshots').select('overall_score').eq('tenant_id', tenantId).order('snapshot_date', { ascending: false }).limit(1).maybeSingle(),
    supabaseAdmin.from('valuation_snapshots').select('estimated_value').eq('tenant_id', tenantId).order('snapshot_date', { ascending: false }).limit(1).maybeSingle(),
  ])

  const compliance = compRes.data ?? []
  const contracts = contractRes.data ?? []

  const deadlines: Deadline[] = compliance
    .map(c => ({ title: c.title, dueDate: c.due_date, daysLeft: daysUntil(c.due_date), kind: c.item_type || 'compliance', penalty: c.penalty_description ?? null }))
    .filter(d => d.daysLeft === null || d.daysLeft <= 60)
    .sort((a, b) => (a.daysLeft ?? 999) - (b.daysLeft ?? 999))
    .slice(0, 8)

  const complianceDue = compliance.filter(c => { const d = daysUntil(c.due_date); return d !== null && d <= 14 }).length
  const contractsExpiring = contracts.filter(c => { const d = daysUntil(c.end_date); return d !== null && d >= 0 && d <= 30 }).length
  const contractsAwaiting = contracts.filter(c => c.status === 'sent').length
  const healthScore = (healthRes.data as { overall_score?: number } | null)?.overall_score ?? null
  const valuation = (valRes.data as { estimated_value?: number } | null)?.estimated_value ?? null

  const signal: GovernanceSignal = {
    complianceDue, contractsExpiring, contractsAwaiting,
    health: complianceDue > 0 ? 'bad' : contractsExpiring > 0 ? 'watch' : 'good',
  }

  return { signal, deadlines, contractsExpiring, contractsAwaiting, healthScore, valuation }
}

export async function refreshGovernanceSignal(tenantId: string): Promise<GovernanceSignal> {
  const intel = await buildGovernanceIntel(tenantId)
  await publishSignal('governance', tenantId, intel.signal)
  return intel.signal
}
