/**
 * Server-only agent module — uses supabaseAdmin.
 * Do NOT import this in 'use client' components.
 * Client components should import from lib/ai/agents.config.ts
 */

import { supabaseAdmin } from '@/lib/supabase/admin'
export { AGENT_DEFINITIONS, type AgentType } from './agents.config'

// Fetch real DB data for agents that need it
export async function buildAgentContext(
  agentType: string,
  tenantId: string,
  conversationMessages: string,
  contactIdentifier?: string
): Promise<string> {
  switch (agentType) {
    case 'lookup':
      return buildLookupContext(tenantId, conversationMessages, contactIdentifier)
    case 'advisor':
      return buildAdvisorContext(tenantId, conversationMessages)
    default:
      return conversationMessages
  }
}

async function buildLookupContext(
  tenantId: string,
  conversationMessages: string,
  contactIdentifier?: string
): Promise<string> {
  const parts: string[] = [`CONVERSATION:\n${conversationMessages}\n`]

  if (contactIdentifier) {
    const [staffMatch, invoices, prevConvs] = await Promise.all([
      supabaseAdmin
        .from('staff')
        .select('full_name, role, department, email, phone, leave_balance, leave_taken, after_hours_flag')
        .eq('tenant_id', tenantId)
        .eq('phone', contactIdentifier)
        .maybeSingle(),
      supabaseAdmin
        .from('invoices')
        .select('contact_name, amount, amount_paid, due_date, days_overdue, status, escalation_level')
        .eq('tenant_id', tenantId)
        .eq('contact_phone', contactIdentifier)
        .order('created_at', { ascending: false })
        .limit(3),
      supabaseAdmin
        .from('conversations')
        .select('intent, sentiment, status, created_at')
        .eq('tenant_id', tenantId)
        .eq('contact_identifier', contactIdentifier)
        .order('created_at', { ascending: false })
        .limit(5),
    ])

    if (staffMatch.data) {
      const s = staffMatch.data
      parts.push(`STAFF RECORD:\nName: ${s.full_name}\nRole: ${s.role}\nDepartment: ${s.department}\nEmail: ${s.email}\nLeave balance: ${s.leave_balance} days (${s.leave_taken} taken)\nAfter-hours flag: ${s.after_hours_flag}`)
    }

    if (invoices.data?.length) {
      const invText = invoices.data.map((i) =>
        `- ${i.contact_name}: R${i.amount} (paid R${i.amount_paid}) — ${i.status}, ${i.days_overdue ?? 0} days overdue`
      ).join('\n')
      parts.push(`INVOICE HISTORY:\n${invText}`)
    }

    if (prevConvs.data?.length) {
      const convText = prevConvs.data.map((c) =>
        `- ${new Date(c.created_at).toLocaleDateString('en-ZA')}: ${c.intent} (${c.sentiment ?? 'neutral'}) — ${c.status}`
      ).join('\n')
      parts.push(`CONTACT HISTORY:\n${convText}`)
    }
  }

  if (parts.length === 1) parts.push('No records found for this contact.')
  return parts.join('\n\n')
}

async function buildAdvisorContext(
  tenantId: string,
  conversationMessages: string
): Promise<string> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()

  const [convResult, invoiceResult, staffResult, goalResult, leaveResult, insightsResult] = await Promise.all([
    supabaseAdmin.from('conversations').select('status, sentiment, intent').eq('tenant_id', tenantId).gte('created_at', sevenDaysAgo),
    supabaseAdmin.from('invoices').select('amount, days_overdue, status').eq('tenant_id', tenantId).in('status', ['unpaid', 'partial']),
    supabaseAdmin.from('staff').select('wellness_scores, after_hours_flag').eq('tenant_id', tenantId),
    supabaseAdmin.from('goals').select('title, target_metric, current_value, target_value, progress_pct, status').eq('tenant_id', tenantId).eq('status', 'active').limit(5),
    supabaseAdmin.from('leave_requests').select('status', { count: 'exact' }).eq('tenant_id', tenantId).eq('status', 'approved').gte('end_date', new Date().toISOString().split('T')[0]),
    // Load stored business insights (AI memory) — last 10
    supabaseAdmin.from('business_insights').select('insight, category, extracted_at').eq('tenant_id', tenantId).order('extracted_at', { ascending: false }).limit(10),
  ])

  const convs    = convResult.data    || []
  const invoices = invoiceResult.data || []
  const staff    = staffResult.data   || []
  const goals    = goalResult.data    || []
  const insights = insightsResult.data || []

  const totalDebt    = invoices.reduce((s, i) => s + Number(i.amount), 0)
  const urgentCount  = convs.filter((c) => c.sentiment === 'urgent').length
  const negativeCount = convs.filter((c) => c.sentiment === 'negative').length

  const recent = Date.now() - 7 * 24 * 3600 * 1000
  const allScores = staff.flatMap((s) => {
    const scores = (s.wellness_scores as Array<{ score: number; date: string }>) || []
    return scores.filter((sc) => new Date(sc.date).getTime() > recent).map((sc) => sc.score)
  })
  const wellnessAvg = allScores.length
    ? (allScores.reduce((a, b) => a + b, 0) / allScores.length).toFixed(1)
    : 'N/A'

  const goalsText = goals.length
    ? goals.map((g) => `• ${g.title}: ${g.progress_pct?.toFixed(0) ?? 0}% of ${g.target_value} ${g.target_metric}`).join('\n')
    : 'No active goals set'

  const memoryText = insights.length
    ? insights.map((i) => `• [${i.category || 'general'}] ${i.insight}`).join('\n')
    : 'No stored insights yet — this is the first advisor session.'

  return `CURRENT CONVERSATION:
${conversationMessages}

BUSINESS SNAPSHOT (last 7 days):
- Conversations: ${convs.length} total (${urgentCount} urgent, ${negativeCount} negative)
- Outstanding debt: R${totalDebt.toLocaleString('en-ZA')} across ${invoices.length} unpaid invoices
- Staff on leave today: ${leaveResult.count ?? 0}
- Team wellness avg: ${wellnessAvg}/5
- After-hours staff: ${staff.filter((s) => s.after_hours_flag).length}

ACTIVE GOALS:
${goalsText}

BUSINESS MEMORY (insights from previous advisor sessions):
${memoryText}

Instructions: Use the business memory to provide continuity. Reference past patterns when relevant. After advising, the system will extract new insights from your response to update the memory.`
}

// Extract and store up to 3 insights from an advisor response
export async function storeAdvisorInsights(
  tenantId: string,
  advisorResponse: string
): Promise<void> {
  // Simple heuristic: look for sentences with business-relevant signals
  const sentences = advisorResponse
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 30 && s.length < 300)

  const patterns = [
    { regex: /revenue|income|sales|profit|cash flow/i, category: 'revenue'    },
    { regex: /staff|team|wellness|burnout|morale/i,    category: 'staff'      },
    { regex: /invoice|debt|overdue|collect/i,          category: 'operations' },
    { regex: /trend|pattern|consistent|usually/i,      category: 'market'     },
  ]

  const insights: { tenantId: string; insight: string; category: string }[] = []

  for (const sentence of sentences.slice(0, 8)) {
    if (insights.length >= 3) break
    for (const { regex, category } of patterns) {
      if (regex.test(sentence)) {
        insights.push({ tenantId, insight: sentence, category })
        break
      }
    }
  }

  if (insights.length === 0) return

  const { error } = await supabaseAdmin.from('business_insights').insert(
    insights.map((i) => ({
      tenant_id:    i.tenantId,
      insight:      i.insight,
      category:     i.category,
      extracted_at: new Date().toISOString(),
    }))
  )
  if (error) console.error('[AdvisorMemory] Insert failed:', error)
}
