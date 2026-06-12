/**
 * Business Health Score Engine — Phase 2
 *
 * Scores a tenant across 6 dimensions (0–100 each).
 * Overall score = weighted average.
 * Runs weekly via Inngest healthScore function.
 */

import { supabaseAdmin } from '@/lib/supabase/admin'

export interface HealthDimension {
  score:   number   // 0–100
  details: Record<string, number | string | null>
  signals: string[] // human-readable key findings
}

export interface HealthScoreResult {
  overall:             number
  financial:           HealthDimension
  legal:               HealthDimension
  people:              HealthDimension
  customer:            HealthDimension
  operational:         HealthDimension
  strategic:           HealthDimension
}

// Dimension weights — must sum to 1.0
const WEIGHTS = {
  financial:   0.25,
  legal:       0.20,
  people:      0.15,
  customer:    0.15,
  operational: 0.15,
  strategic:   0.10,
}

export async function calculateHealthScore(tenantId: string): Promise<HealthScoreResult> {
  const [financial, legal, people, customer, operational, strategic] = await Promise.all([
    scoreFinancial(tenantId),
    scoreLegal(tenantId),
    scorePeople(tenantId),
    scoreCustomer(tenantId),
    scoreOperational(tenantId),
    scoreStrategic(tenantId),
  ])

  const overall = Math.round(
    financial.score   * WEIGHTS.financial   +
    legal.score       * WEIGHTS.legal       +
    people.score      * WEIGHTS.people      +
    customer.score    * WEIGHTS.customer    +
    operational.score * WEIGHTS.operational +
    strategic.score   * WEIGHTS.strategic
  )

  return { overall, financial, legal, people, customer, operational, strategic }
}

// ─── Financial Health ─────────────────────────────────────────────────────────

async function scoreFinancial(tenantId: string): Promise<HealthDimension> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()

  const [overdueRes, recentPaidRes, invoiceRes] = await Promise.all([
    supabaseAdmin
      .from('invoices')
      .select('amount_due, due_date')
      .eq('tenant_id', tenantId)
      .eq('status', 'overdue'),
    supabaseAdmin
      .from('invoices')
      .select('amount_due, paid_at')
      .eq('tenant_id', tenantId)
      .eq('status', 'paid')
      .gte('paid_at', thirtyDaysAgo),
    supabaseAdmin
      .from('invoices')
      .select('amount_due, due_date, status')
      .eq('tenant_id', tenantId)
      .gte('created_at', ninetyDaysAgo),
  ])

  const overdue    = overdueRes.data  ?? []
  const recentPaid = recentPaidRes.data ?? []
  const allInvoices = invoiceRes.data ?? []

  const totalOverdue = overdue.reduce((s, i) => s + (i.amount_due ?? 0), 0)
  const totalRevenue = recentPaid.reduce((s, i) => s + (i.amount_due ?? 0), 0)

  // Debtor days (approximate)
  const avgDebtorDays = allInvoices.length > 0
    ? overdue.length / Math.max(allInvoices.length, 1) * 30
    : 0

  // Score components
  let score = 100

  // Overdue invoices penalise heavily
  if (overdue.length > 0)    score -= Math.min(40, overdue.length * 8)
  // High debtor days penalise
  if (avgDebtorDays > 60)    score -= 20
  else if (avgDebtorDays > 30) score -= 10
  // Reward recent revenue
  if (totalRevenue > 0)      score = Math.min(100, score + 10)

  const signals: string[] = []
  if (overdue.length > 0)    signals.push(`${overdue.length} overdue invoice${overdue.length > 1 ? 's' : ''} (R${totalOverdue.toFixed(0)} outstanding)`)
  if (avgDebtorDays > 30)    signals.push(`Debtor days ~${Math.round(avgDebtorDays)} days (target: <30)`)
  if (totalRevenue > 0)      signals.push(`R${totalRevenue.toFixed(0)} collected in last 30 days`)

  return {
    score: Math.max(0, Math.min(100, score)),
    details: { overdueCount: overdue.length, totalOverdue, avgDebtorDays, recentRevenue: totalRevenue },
    signals,
  }
}

// ─── Legal Compliance ─────────────────────────────────────────────────────────

async function scoreLegal(tenantId: string): Promise<HealthDimension> {
  // Check documents — contracts, compliance items
  const [docsRes] = await Promise.all([
    supabaseAdmin
      .from('documents')
      .select('document_type, expiry_date')
      .eq('tenant_id', tenantId),
  ])

  const docs = docsRes.data ?? []
  const now  = new Date()

  const expiredDocs = docs.filter(
    (d) => d.expiry_date && new Date(d.expiry_date) < now
  )
  const expiringDocs = docs.filter(
    (d) => d.expiry_date && new Date(d.expiry_date) > now &&
      new Date(d.expiry_date) < new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  )

  let score = 80  // Base: assume moderate compliance without full compliance calendar data
  if (expiredDocs.length > 0)  score -= expiredDocs.length * 10
  if (expiringDocs.length > 0) score -= expiringDocs.length * 5
  if (docs.length >= 5)        score += 10  // Good record-keeping

  const signals: string[] = []
  if (expiredDocs.length > 0)  signals.push(`${expiredDocs.length} expired document${expiredDocs.length > 1 ? 's' : ''} need renewal`)
  if (expiringDocs.length > 0) signals.push(`${expiringDocs.length} document${expiringDocs.length > 1 ? 's' : ''} expiring within 30 days`)
  if (score >= 80)             signals.push('Legal documentation in good order')

  return {
    score: Math.max(0, Math.min(100, score)),
    details: { totalDocs: docs.length, expiredDocs: expiredDocs.length, expiringDocs: expiringDocs.length },
    signals,
  }
}

// ─── People Management ────────────────────────────────────────────────────────

async function scorePeople(tenantId: string): Promise<HealthDimension> {
  const [staffRes, wellnessRes, leaveRes] = await Promise.all([
    supabaseAdmin.from('staff').select('id, active').eq('tenant_id', tenantId),
    supabaseAdmin
      .from('wellness_checkins')
      .select('score')
      .eq('tenant_id', tenantId)
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
    supabaseAdmin
      .from('leave_requests')
      .select('status')
      .eq('tenant_id', tenantId)
      .eq('status', 'pending'),
  ])

  const staff         = staffRes.data    ?? []
  const wellnessItems = wellnessRes.data ?? []
  const pendingLeave  = leaveRes.data    ?? []

  const activeStaff   = staff.filter((s) => s.active !== false).length
  const avgWellness   = wellnessItems.length > 0
    ? wellnessItems.reduce((s, w) => s + (w.score ?? 3), 0) / wellnessItems.length
    : null

  let score = 70  // Base

  if (activeStaff === 0)          score = 50  // Solo mode — not penalised heavily
  if (avgWellness !== null) {
    if (avgWellness >= 4)         score += 20
    else if (avgWellness >= 3)    score += 10
    else if (avgWellness < 2.5)   score -= 20
  }
  if (pendingLeave.length > 3)    score -= 10  // Many unprocessed leave requests

  const signals: string[] = []
  if (avgWellness !== null && avgWellness < 2.5) signals.push(`Team wellness average ${avgWellness.toFixed(1)}/5 — burnout risk`)
  if (pendingLeave.length > 0)                   signals.push(`${pendingLeave.length} pending leave request${pendingLeave.length > 1 ? 's' : ''}`)
  if (avgWellness !== null && avgWellness >= 4)  signals.push(`Healthy team wellness average: ${avgWellness.toFixed(1)}/5`)

  return {
    score: Math.max(0, Math.min(100, score)),
    details: { activeStaff, avgWellness, pendingLeave: pendingLeave.length },
    signals,
  }
}

// ─── Customer Relations ───────────────────────────────────────────────────────

async function scoreCustomer(tenantId: string): Promise<HealthDimension> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [convRes, contactRes] = await Promise.all([
    supabaseAdmin
      .from('conversations')
      .select('status, sentiment')
      .eq('tenant_id', tenantId)
      .gte('created_at', sevenDaysAgo),
    supabaseAdmin
      .from('contacts')
      .select('id')
      .eq('tenant_id', tenantId),
  ])

  const convs    = convRes.data    ?? []
  const contacts = contactRes.data ?? []

  const resolved  = convs.filter((c) => c.status === 'resolved').length
  const total     = convs.length
  const negative  = convs.filter((c) => c.sentiment === 'negative' || c.sentiment === 'urgent').length
  const resolutionRate = total > 0 ? (resolved / total) * 100 : 100

  let score = 75

  if (resolutionRate >= 90)  score += 20
  else if (resolutionRate >= 70) score += 5
  else if (resolutionRate < 50)  score -= 20

  if (negative > 3)              score -= 15
  if (contacts.length >= 50)     score += 5  // Good client base

  const signals: string[] = []
  if (total > 0)                 signals.push(`${Math.round(resolutionRate)}% conversation resolution rate (7 days)`)
  if (negative > 0)              signals.push(`${negative} negative/urgent conversation${negative > 1 ? 's' : ''} this week`)
  if (contacts.length > 0)       signals.push(`${contacts.length} total contacts`)

  return {
    score: Math.max(0, Math.min(100, score)),
    details: { totalConversations: total, resolutionRate, negativeCount: negative, totalContacts: contacts.length },
    signals,
  }
}

// ─── Operational Maturity ─────────────────────────────────────────────────────

async function scoreOperational(tenantId: string): Promise<HealthDimension> {
  const [goalsRes, docsRes] = await Promise.all([
    supabaseAdmin.from('goals').select('status').eq('tenant_id', tenantId),
    supabaseAdmin.from('documents').select('id').eq('tenant_id', tenantId),
  ])

  const goals = goalsRes.data ?? []
  const docs  = docsRes.data  ?? []

  const onTrack     = goals.filter((g) => g.status === 'on_track').length
  const totalGoals  = goals.length
  const goalHitRate = totalGoals > 0 ? (onTrack / totalGoals) * 100 : 0

  let score = 60  // Base

  if (docs.length >= 10)       score += 15  // Good documentation
  if (totalGoals >= 3)         score += 10  // Has goals set
  if (goalHitRate >= 80)       score += 15
  else if (goalHitRate >= 50)  score += 5

  const signals: string[] = []
  if (totalGoals > 0)          signals.push(`${Math.round(goalHitRate)}% of goals on track`)
  if (docs.length > 0)         signals.push(`${docs.length} document${docs.length > 1 ? 's' : ''} filed`)
  if (totalGoals === 0)        signals.push('No goals set — add your first 90-day goal')

  return {
    score: Math.max(0, Math.min(100, score)),
    details: { totalGoals, onTrackGoals: onTrack, goalHitRate, documentCount: docs.length },
    signals,
  }
}

// ─── Strategic Readiness ──────────────────────────────────────────────────────

async function scoreStrategic(tenantId: string): Promise<HealthDimension> {
  const [goalsRes] = await Promise.all([
    supabaseAdmin.from('goals').select('status, target_date').eq('tenant_id', tenantId),
  ])

  const goals = goalsRes.data ?? []
  const now   = new Date()

  const futureGoals = goals.filter(
    (g) => g.target_date && new Date(g.target_date) > now
  )
  const overdueGoals = goals.filter(
    (g) => g.target_date && new Date(g.target_date) < now && g.status !== 'completed'
  )

  let score = 60

  if (futureGoals.length >= 3)    score += 20
  if (futureGoals.length >= 1)    score += 10
  if (overdueGoals.length > 0)    score -= overdueGoals.length * 8

  const signals: string[] = []
  if (futureGoals.length > 0)     signals.push(`${futureGoals.length} future goal${futureGoals.length > 1 ? 's' : ''} defined`)
  if (overdueGoals.length > 0)    signals.push(`${overdueGoals.length} overdue goal${overdueGoals.length > 1 ? 's' : ''}`)
  if (goals.length === 0)         signals.push('Set your first strategic goals to improve this score')

  return {
    score: Math.max(0, Math.min(100, score)),
    details: { totalGoals: goals.length, futureGoals: futureGoals.length, overdueGoals: overdueGoals.length },
    signals,
  }
}

// ─── Save snapshot ────────────────────────────────────────────────────────────

export async function saveHealthSnapshot(
  tenantId: string,
  result: HealthScoreResult
): Promise<void> {
  const today = new Date().toISOString().split('T')[0]

  await supabaseAdmin
    .from('business_health_snapshots')
    .upsert({
      tenant_id:            tenantId,
      snapshot_date:        today,
      overall_score:        result.overall,
      financial_health:     result.financial.score,
      legal_compliance:     result.legal.score,
      people_management:    result.people.score,
      customer_relations:   result.customer.score,
      operational_maturity: result.operational.score,
      strategic_readiness:  result.strategic.score,
      dimension_details: {
        financial:   result.financial.details,
        legal:       result.legal.details,
        people:      result.people.details,
        customer:    result.customer.details,
        operational: result.operational.details,
        strategic:   result.strategic.details,
      },
    }, { onConflict: 'tenant_id, snapshot_date' })
}
