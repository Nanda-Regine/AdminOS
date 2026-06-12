import { inngest } from '@/inngest/client'
import { supabaseAdmin } from '@/lib/supabase/admin'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic()

interface BoardPackData {
  period_label: string
  executive_summary: string
  financial_snapshot: {
    revenue:          number
    expenses:         number
    net_profit:       number
    profit_margin_pct: number
    cash_position:    number | null
    revenue_vs_prior: number | null
  }
  kpi_highlights:     Array<{ name: string; value: string; trend: 'up' | 'down' | 'flat'; note: string }>
  customers:          { new: number; active: number; nps_average: number | null; nps_responses: number }
  invoices:           { total_billed: number; paid: number; outstanding: number; overdue: number }
  staff_summary:      { headcount: number; leaves_approved: number; ir_cases_open: number }
  compliance_health:  { overdue_items: number; upcoming_30d: number }
  risks_and_issues:   string[]
  opportunities:      string[]
  decisions_needed:   string[]
  ai_narrative:       string
}

// Triggered on-demand via adminos/board_pack.generate event
export const onBoardPackRequested = inngest.createFunction(
  { id: 'board-pack-generate', retries: 1 },
  { event: 'adminos/board_pack.generate' },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async ({ event, step }: any) => {
    const { tenant_id, board_pack_id, period_start, period_end, period_label } = event.data as {
      tenant_id:     string
      board_pack_id: string
      period_start:  string
      period_end:    string
      period_label:  string
    }

    // Gather all data in parallel steps
    const [financials, customers, invoices, staff, compliance, goals] = await Promise.all([
      step.run('gather-financials', () => gatherFinancials(tenant_id, period_start, period_end)),
      step.run('gather-customers',  () => gatherCustomers(tenant_id, period_start, period_end)),
      step.run('gather-invoices',   () => gatherInvoices(tenant_id, period_start, period_end)),
      step.run('gather-staff',      () => gatherStaff(tenant_id, period_start, period_end)),
      step.run('gather-compliance', () => gatherCompliance(tenant_id, period_end)),
      step.run('gather-goals',      () => gatherGoals(tenant_id)),
    ])

    const packData = await step.run('generate-narrative', async () => {
      const contextSummary = JSON.stringify({
        period_label,
        financials,
        customers,
        invoices,
        staff,
        compliance,
        goals,
      }, null, 2)

      // Build KPIs array
      const revenueVsPrior = financials.revenue_vs_prior
      const kpis = [
        {
          name:  'Revenue',
          value: `R ${financials.revenue.toLocaleString('en-ZA')}`,
          trend: revenueVsPrior === null ? 'flat' : revenueVsPrior >= 0 ? 'up' : 'down',
          note:  revenueVsPrior !== null ? `${revenueVsPrior >= 0 ? '+' : ''}${revenueVsPrior.toFixed(1)}% vs prior period` : 'First period',
        } as const,
        {
          name:  'Net Profit',
          value: `R ${financials.net_profit.toLocaleString('en-ZA')}`,
          trend: financials.net_profit >= 0 ? 'up' : 'down',
          note:  `${financials.profit_margin_pct.toFixed(1)}% margin`,
        } as const,
        {
          name:  'Active Customers',
          value: String(customers.active),
          trend: customers.new > 0 ? 'up' : 'flat',
          note:  `${customers.new} new this period`,
        } as const,
        {
          name:  'Outstanding Invoices',
          value: `R ${invoices.outstanding.toLocaleString('en-ZA')}`,
          trend: invoices.overdue > 0 ? 'down' : 'flat',
          note:  invoices.overdue > 0 ? `R ${invoices.overdue.toLocaleString('en-ZA')} overdue` : 'All current',
        } as const,
      ]

      // Generate AI narrative — input is already-aggregated numbers, never raw user data
      const aiResponse = await anthropic.messages.create({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 600,
        messages: [{
          role:    'user',
          content: `You are a South African business advisor writing an executive summary for a board pack.
Write a concise 3-paragraph executive summary in professional but accessible English for a small-to-medium business owner.

Period: ${period_label}

Data:
${contextSummary}

Format:
- Paragraph 1: Financial performance (2-3 sentences)
- Paragraph 2: Operational highlights — customers, staff, compliance (2-3 sentences)
- Paragraph 3: Key focus areas and opportunities going forward (2-3 sentences)

Be specific and data-driven. Mention actual numbers. Keep it under 200 words.`,
        }],
      })

      const narrative = (aiResponse.content[0] as { type: string; text: string }).text

      // Derive risks, opportunities, decisions
      const risks: string[] = []
      const opportunities: string[] = []
      const decisions: string[] = []

      if (invoices.overdue > 0) risks.push(`Outstanding overdue invoices of R ${invoices.overdue.toLocaleString('en-ZA')} require follow-up`)
      if (compliance.overdue_items > 0) risks.push(`${compliance.overdue_items} overdue compliance item(s) — immediate action required`)
      if (staff.ir_cases_open > 0) risks.push(`${staff.ir_cases_open} open IR case(s) in progress`)
      if (financials.profit_margin_pct < 0) risks.push('Business operated at a loss this period — review cost structure')

      if (customers.new > 0) opportunities.push(`${customers.new} new customers acquired — review onboarding and upsell opportunities`)
      if (goals.completion_rate > 0.7) opportunities.push(`${(goals.completion_rate * 100).toFixed(0)}% goal completion rate — maintain momentum`)
      if (financials.revenue_vs_prior && financials.revenue_vs_prior > 0) opportunities.push('Revenue trending up — consider reinvestment strategy')

      if (compliance.upcoming_30d > 0) decisions.push(`Review ${compliance.upcoming_30d} compliance deadline(s) due in 30 days`)
      if (goals.overdue > 0) decisions.push(`${goals.overdue} business goal(s) are past target date — revise or close`)

      const pack: BoardPackData = {
        period_label,
        executive_summary: narrative,
        financial_snapshot: financials,
        kpi_highlights:     kpis,
        customers,
        invoices,
        staff_summary:      staff,
        compliance_health:  compliance,
        risks_and_issues:   risks,
        opportunities,
        decisions_needed:   decisions,
        ai_narrative:       narrative,
      }

      return pack
    })

    // Save completed pack data
    await step.run('save-pack', async () => {
      await supabaseAdmin
        .from('board_packs')
        .update({ pack_data: packData, status: 'ready' })
        .eq('id', board_pack_id)
    })

    return { board_pack_id, status: 'ready' }
  }
)

// Monthly auto-generation for Scale/Partner tenants
export const boardPackMonthlyCron = inngest.createFunction(
  { id: 'board-pack-monthly', retries: 1 },
  { cron: '0 6 1 * *' },  // 1st of every month at 6am
  async ({ step }) => {
    const today      = new Date()
    const lastMonth  = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    const monthEnd   = new Date(today.getFullYear(), today.getMonth(), 0)
    const monthLabel = lastMonth.toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' })

    const { data: eligibleTenants } = await supabaseAdmin
      .from('tenants')
      .select('id, owner_id:created_by')
      .in('plan', ['scale', 'partner'])

    if (!eligibleTenants?.length) return { generated: 0 }

    let generated = 0

    for (const tenant of eligibleTenants) {
      await step.run(`generate-${tenant.id}`, async () => {
        const { data: pack } = await supabaseAdmin
          .from('board_packs')
          .insert({
            tenant_id:     tenant.id,
            generated_by:  tenant.owner_id ?? tenant.id,
            period_label:  monthLabel,
            period_start:  lastMonth.toISOString().split('T')[0],
            period_end:    monthEnd.toISOString().split('T')[0],
            pack_data:     {},
            status:        'generating',
          })
          .select('id')
          .single()

        if (!pack) return

        // Queue the actual generation
        const { inngest: inngestClient } = await import('@/inngest/client')
        await inngestClient.send({
          name: 'adminos/board_pack.generate',
          data: {
            tenant_id:     tenant.id,
            board_pack_id: pack.id,
            period_start:  lastMonth.toISOString().split('T')[0],
            period_end:    monthEnd.toISOString().split('T')[0],
            period_label:  monthLabel,
          },
        })

        generated++
      })
    }

    return { generated }
  }
)

// Data gathering helpers

async function gatherFinancials(tenantId: string, from: string, to: string) {
  const [invoiceData, priorData] = await Promise.all([
    supabaseAdmin
      .from('invoices')
      .select('total, status, subtotal')
      .eq('tenant_id', tenantId)
      .gte('created_at', from)
      .lte('created_at', to),
    supabaseAdmin
      .from('invoices')
      .select('total')
      .eq('tenant_id', tenantId)
      .eq('status', 'paid')
      .gte('created_at', new Date(new Date(from).getTime() - (new Date(to).getTime() - new Date(from).getTime())).toISOString())
      .lt('created_at', from),
  ])

  const revenue  = (invoiceData.data ?? [])
    .filter(i => i.status === 'paid')
    .reduce((s, i) => s + (i.total ?? 0), 0)

  const priorRevenue = (priorData.data ?? [])
    .reduce((s, i) => s + (i.total ?? 0), 0)

  // Approximate expenses via payroll + any expense records
  const { data: expenses } = await supabaseAdmin
    .from('expenses')
    .select('amount')
    .eq('tenant_id', tenantId)
    .gte('created_at', from)
    .lte('created_at', to)

  const totalExpenses = (expenses ?? []).reduce((s, e) => s + (e.amount ?? 0), 0)
  const netProfit     = revenue - totalExpenses
  const margin        = revenue > 0 ? (netProfit / revenue) * 100 : 0
  const revenueVsPrior = priorRevenue > 0 ? ((revenue - priorRevenue) / priorRevenue) * 100 : null

  return {
    revenue,
    expenses:         totalExpenses,
    net_profit:       netProfit,
    profit_margin_pct: margin,
    cash_position:    null,
    revenue_vs_prior: revenueVsPrior,
  }
}

async function gatherCustomers(tenantId: string, from: string, to: string) {
  const { count: newCount } = await supabaseAdmin
    .from('contacts')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('type', 'customer')
    .gte('created_at', from)
    .lte('created_at', to)

  const { count: activeCount } = await supabaseAdmin
    .from('contacts')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('type', 'customer')

  const { data: npsData } = await supabaseAdmin
    .from('nps_surveys')
    .select('score')
    .eq('tenant_id', tenantId)
    .not('score', 'is', null)
    .gte('responded_at', from)
    .lte('responded_at', to)

  const npsAvg = npsData?.length
    ? npsData.reduce((s, n) => s + (n.score ?? 0), 0) / npsData.length
    : null

  return {
    new:           newCount ?? 0,
    active:        activeCount ?? 0,
    nps_average:   npsAvg,
    nps_responses: npsData?.length ?? 0,
  }
}

async function gatherInvoices(tenantId: string, from: string, to: string) {
  const { data } = await supabaseAdmin
    .from('invoices')
    .select('total, amount_due, status')
    .eq('tenant_id', tenantId)
    .gte('created_at', from)
    .lte('created_at', to)

  const invoices = data ?? []
  const billed      = invoices.reduce((s, i) => s + (i.total ?? 0), 0)
  const paid        = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + (i.total ?? 0), 0)
  const outstanding = invoices.filter(i => !['paid','cancelled'].includes(i.status)).reduce((s, i) => s + (i.amount_due ?? 0), 0)
  const overdue     = invoices.filter(i => i.status === 'overdue').reduce((s, i) => s + (i.amount_due ?? 0), 0)

  return { total_billed: billed, paid, outstanding, overdue }
}

async function gatherStaff(tenantId: string, from: string, to: string) {
  const { count: headcount } = await supabaseAdmin
    .from('staff')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('employment_status', 'active')

  const { count: leaves } = await supabaseAdmin
    .from('leave_requests')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('status', 'approved')
    .gte('created_at', from)
    .lte('created_at', to)

  const { count: irCases } = await supabaseAdmin
    .from('ir_cases')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .in('status', ['open', 'in_progress'])

  return {
    headcount:       headcount ?? 0,
    leaves_approved: leaves    ?? 0,
    ir_cases_open:   irCases   ?? 0,
  }
}

async function gatherCompliance(tenantId: string, to: string) {
  const today    = to
  const in30days = new Date(new Date(to).getTime() + 30 * 86400000).toISOString().split('T')[0]

  const { count: overdueCount } = await supabaseAdmin
    .from('compliance_items')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('status', 'overdue')

  const { count: upcomingCount } = await supabaseAdmin
    .from('compliance_items')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .in('status', ['pending', 'in_progress'])
    .gte('due_date', today)
    .lte('due_date', in30days)

  return {
    overdue_items: overdueCount ?? 0,
    upcoming_30d:  upcomingCount ?? 0,
  }
}

async function gatherGoals(tenantId: string) {
  const { data } = await supabaseAdmin
    .from('goals')
    .select('status, target_date')
    .eq('tenant_id', tenantId)
    .in('status', ['active', 'completed', 'cancelled'])

  const goals           = data ?? []
  const completed       = goals.filter(g => g.status === 'completed').length
  const total           = goals.length
  const today           = new Date().toISOString().split('T')[0]
  const overdue         = goals.filter(g => g.status === 'active' && g.target_date && g.target_date < today).length
  const completionRate  = total > 0 ? completed / total : 0

  return { total, completed, overdue, completion_rate: completionRate }
}
