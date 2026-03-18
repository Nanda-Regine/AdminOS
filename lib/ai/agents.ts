import { supabaseAdmin } from '@/lib/supabase/admin'

export const AGENT_DEFINITIONS = {
  draft: {
    name: 'Draft reply',
    description: 'Draft the ideal reply to this conversation',
    buildPrompt: (_tenantContext: string) =>
      'You are a professional communications assistant. Draft the ideal reply to this conversation. Be concise for WhatsApp (under 250 chars). Match the business tone. Be warm but efficient.',
    buildContext: (messages: string) => messages,
  },

  summarise: {
    name: 'Summarise',
    description: 'Summarise this thread in 3 bullet points',
    buildPrompt: (_tenantContext: string) =>
      'Summarise this conversation in exactly 3 bullet points: (1) what the person wants, (2) what has happened so far, (3) what action is needed now. Maximum 80 words total.',
    buildContext: (messages: string) => messages,
  },

  lookup: {
    name: 'Lookup record',
    description: 'Find this contact in the business database',
    buildPrompt: (_tenantContext: string) =>
      'You are a database assistant. Based on the contact information and database records provided, surface the most relevant details for the manager right now. Be direct and factual. Only state what is in the records.',
    buildContext: (messages: string) => messages, // enriched in route
  },

  escalation: {
    name: 'Escalation guide',
    description: 'Guide for handling this situation personally',
    buildPrompt: (_tenantContext: string) =>
      'This conversation needs human handling. Tell the manager: (1) what happened, (2) what the person needs emotionally and practically, (3) exactly what to say, (4) what to avoid saying, (5) what the ideal outcome looks like. Be direct and practical.',
    buildContext: (messages: string) => messages,
  },

  advisor: {
    name: 'Business advisor',
    description: 'AI insight connected to your business goals',
    buildPrompt: (_tenantContext: string) =>
      'You are a world-class business advisor with deep knowledge of African SME operations, behavioural economics, and data-driven management. Review the business data provided and give ONE sharp, actionable insight. Connect it to the company\'s specific goals. Reference a real framework or principle (Pareto, Atomic Habits, first-principles, etc.) when relevant. Be direct. Max 150 words.',
    buildContext: (messages: string) => messages, // enriched in route
  },
} as const

export type AgentType = keyof typeof AGENT_DEFINITIONS

// Fetch real data for agents that need DB context
export async function buildAgentContext(
  agentType: AgentType,
  tenantId: string,
  conversationMessages: string,
  contactIdentifier?: string
): Promise<string> {
  switch (agentType) {
    case 'lookup': {
      return buildLookupContext(tenantId, conversationMessages, contactIdentifier)
    }
    case 'advisor': {
      return buildAdvisorContext(tenantId, conversationMessages)
    }
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
    // Search staff by phone
    const { data: staffMatch } = await supabaseAdmin
      .from('staff')
      .select('full_name, role, department, email, phone, leave_balance, leave_taken, after_hours_flag')
      .eq('tenant_id', tenantId)
      .eq('phone', contactIdentifier)
      .maybeSingle()

    if (staffMatch) {
      parts.push(`STAFF RECORD:\nName: ${staffMatch.full_name}\nRole: ${staffMatch.role}\nDepartment: ${staffMatch.department}\nEmail: ${staffMatch.email}\nLeave balance: ${staffMatch.leave_balance} days (${staffMatch.leave_taken} taken)\nAfter-hours flag: ${staffMatch.after_hours_flag}`)
    }

    // Search invoices by contact phone
    const { data: invoices } = await supabaseAdmin
      .from('invoices')
      .select('contact_name, amount, amount_paid, due_date, days_overdue, status, escalation_level')
      .eq('tenant_id', tenantId)
      .eq('contact_phone', contactIdentifier)
      .order('created_at', { ascending: false })
      .limit(3)

    if (invoices?.length) {
      const invText = invoices.map((i) =>
        `- ${i.contact_name}: R${i.amount} (paid R${i.amount_paid}) — ${i.status}, ${i.days_overdue ?? 0} days overdue, escalation level ${i.escalation_level}`
      ).join('\n')
      parts.push(`INVOICE HISTORY:\n${invText}`)
    }

    // Recent conversations
    const { data: prevConvs } = await supabaseAdmin
      .from('conversations')
      .select('intent, sentiment, status, created_at')
      .eq('tenant_id', tenantId)
      .eq('contact_identifier', contactIdentifier)
      .order('created_at', { ascending: false })
      .limit(5)

    if (prevConvs?.length) {
      const convText = prevConvs.map((c) =>
        `- ${new Date(c.created_at).toLocaleDateString('en-ZA')}: ${c.intent} (${c.sentiment ?? 'neutral'}) — ${c.status}`
      ).join('\n')
      parts.push(`CONTACT HISTORY (last 5 conversations):\n${convText}`)
    }
  }

  if (parts.length === 1) {
    parts.push('No records found for this contact in the database.')
  }

  return parts.join('\n\n')
}

async function buildAdvisorContext(
  tenantId: string,
  conversationMessages: string
): Promise<string> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()

  const [convResult, invoiceResult, staffResult, goalResult, leaveResult] = await Promise.all([
    supabaseAdmin
      .from('conversations')
      .select('status, sentiment, intent')
      .eq('tenant_id', tenantId)
      .gte('created_at', sevenDaysAgo),
    supabaseAdmin
      .from('invoices')
      .select('amount, days_overdue, status')
      .eq('tenant_id', tenantId)
      .in('status', ['unpaid', 'partial']),
    supabaseAdmin
      .from('staff')
      .select('wellness_scores, after_hours_flag')
      .eq('tenant_id', tenantId),
    supabaseAdmin
      .from('goals')
      .select('title, target_metric, current_value, target_value, progress_pct, status')
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .limit(5),
    supabaseAdmin
      .from('leave_requests')
      .select('status')
      .eq('tenant_id', tenantId)
      .eq('status', 'approved')
      .gte('end_date', new Date().toISOString().split('T')[0]),
  ])

  const convs = convResult.data || []
  const invoices = invoiceResult.data || []
  const staff = staffResult.data || []
  const goals = goalResult.data || []

  const totalDebt = invoices.reduce((s, i) => s + Number(i.amount), 0)
  const urgentCount = convs.filter((c) => c.sentiment === 'urgent').length
  const negativeCount = convs.filter((c) => c.sentiment === 'negative').length

  // 7-day wellness average
  const recent = Date.now() - 7 * 24 * 3600 * 1000
  const allScores = staff.flatMap((s) => {
    const scores = (s.wellness_scores as Array<{ score: number; date: string }>) || []
    return scores.filter((sc) => new Date(sc.date).getTime() > recent).map((sc) => sc.score)
  })
  const wellnessAvg = allScores.length
    ? (allScores.reduce((a, b) => a + b, 0) / allScores.length).toFixed(1)
    : 'N/A'
  const afterHoursStaff = staff.filter((s) => s.after_hours_flag).length

  const goalsText = goals.length
    ? goals.map((g) => `• ${g.title}: ${g.progress_pct?.toFixed(0) ?? 0}% of ${g.target_value} ${g.target_metric}`).join('\n')
    : 'No active goals set'

  const businessData = `
CURRENT CONVERSATION CONTEXT:
${conversationMessages}

BUSINESS SNAPSHOT (last 7 days):
- Total conversations: ${convs.length} (${urgentCount} urgent, ${negativeCount} negative sentiment)
- Outstanding debt: R${totalDebt.toLocaleString('en-ZA')} across ${invoices.length} unpaid invoices
- Staff on leave today: ${leaveResult.count ?? 0}
- Team wellness avg (7-day): ${wellnessAvg}/5
- Staff messaging after hours: ${afterHoursStaff}

ACTIVE GOALS:
${goalsText}
`.trim()

  return businessData
}
