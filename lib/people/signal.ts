/**
 * People intelligence — approvals waiting, team wellness, open discipline.
 * Same vertical-slice contract. Outcome: a compliant, well-run team.
 */

import { supabaseAdmin } from '@/lib/supabase/admin'
import { publishSignal, type PeopleSignal } from '@/lib/signals/bus'

export interface Approval { kind: 'leave' | 'expense'; who: string; detail: string }
export interface WellnessRow { name: string; score: number | null }

export interface PeopleIntel {
  signal: PeopleSignal
  activeStaff: number
  pendingLeave: number
  pendingExpenses: number
  approvals: Approval[]
  wellnessAvg: number | null
  lowWellness: { name: string; score: number }[]   // score guaranteed non-null (filtered)
  openIr: number
}

const recentAvg = (scores: number[] | null | undefined): number | null => {
  const arr = Array.isArray(scores) ? scores.slice(-7) : []
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null
}

export async function buildPeopleIntel(tenantId: string): Promise<PeopleIntel> {
  const [staffRes, leaveRes, expRes, irRes] = await Promise.all([
    supabaseAdmin.from('staff').select('full_name, wellness_scores').eq('tenant_id', tenantId).eq('active', true),
    supabaseAdmin.from('leave_requests').select('days, reason, status, staff:staff(full_name)').eq('tenant_id', tenantId).eq('status', 'pending'),
    supabaseAdmin.from('expenses').select('amount, category, status, staff:staff(full_name)').eq('tenant_id', tenantId).eq('status', 'pending'),
    supabaseAdmin.from('disciplinary_records').select('id').eq('tenant_id', tenantId).is('acknowledged_at', null),
  ])

  const staff = staffRes.data ?? []
  const leave = leaveRes.data ?? []
  const expenses = expRes.data ?? []

  const nameOf = (embed: unknown) => {
    const e = Array.isArray(embed) ? embed[0] : embed
    return (e as { full_name?: string } | null)?.full_name ?? 'Staff'
  }

  const approvals: Approval[] = [
    ...leave.map(l => ({ kind: 'leave' as const, who: nameOf(l.staff), detail: `${l.days ?? '?'} days · ${l.reason || 'leave'}` })),
    ...expenses.map(e => ({ kind: 'expense' as const, who: nameOf(e.staff), detail: `R${Number(e.amount || 0).toLocaleString('en-ZA')} · ${e.category || 'expense'}` })),
  ]

  const wellnessRows: WellnessRow[] = staff.map(s => ({ name: s.full_name, score: recentAvg(s.wellness_scores as number[] | null) }))
  const scored = wellnessRows.filter(w => w.score !== null) as { name: string; score: number }[]
  const wellnessAvg = scored.length ? Math.round((scored.reduce((a, b) => a + b.score, 0) / scored.length) * 10) / 10 : null
  const lowWellness = scored.filter(w => w.score < 3).sort((a, b) => a.score - b.score).slice(0, 5)

  const openIr = irRes.data?.length ?? 0

  const signal: PeopleSignal = {
    activeStaff: staff.length,
    pendingLeave: leave.length,
    pendingExpenses: expenses.length,
    wellnessAvg,
    health: (wellnessAvg !== null && wellnessAvg < 3) || openIr > 0 ? 'bad' : (leave.length + expenses.length > 0 ? 'watch' : 'good'),
  }

  return {
    signal, activeStaff: staff.length, pendingLeave: leave.length, pendingExpenses: expenses.length,
    approvals, wellnessAvg, lowWellness, openIr,
  }
}

export async function refreshPeopleSignal(tenantId: string): Promise<PeopleSignal> {
  const intel = await buildPeopleIntel(tenantId)
  await publishSignal('people', tenantId, intel.signal)
  return intel.signal
}
