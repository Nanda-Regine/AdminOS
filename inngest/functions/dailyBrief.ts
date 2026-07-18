import { inngest } from '@/inngest/client'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { writeAuditLog } from '@/lib/security/audit'
import { getModelForFeature } from '@/lib/ai/costControls'
import { setDailyBrief } from '@/lib/signals/brief'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export const dailyBriefEngine = inngest.createFunction(
  { id: 'daily-brief-engine', retries: 2, triggers: [{ event: 'adminos/brief.generate' }] },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async ({ event, step }: any) => {
    const { tenant_id } = event.data as { tenant_id: string }

    const intelligence = await step.run('aggregate-data', async () => {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const todayStr = today.toISOString().split('T')[0]
      const in7Days  = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]

      const [tenantRes, convRes, invoiceRes, staffRes, goalRes, wqRes, complianceRes, healthRes] = await Promise.all([
        supabaseAdmin.from('tenants').select('name, plan, settings, language_primary').eq('id', tenant_id).single(),
        supabaseAdmin.from('conversations').select('id, status, intent, sentiment').eq('tenant_id', tenant_id).eq('status', 'open'),
        supabaseAdmin.from('invoices').select('amount, days_overdue, status').eq('tenant_id', tenant_id).in('status', ['unpaid', 'partial']).gt('days_overdue', 0),
        supabaseAdmin.from('staff').select('id, full_name, wellness_scores').eq('tenant_id', tenant_id).eq('status', 'active'),
        supabaseAdmin.from('goals').select('title, progress_pct, status').eq('tenant_id', tenant_id).eq('status', 'active').limit(5),
        supabaseAdmin.from('workflow_queue').select('workflow_type, status, created_at').eq('tenant_id', tenant_id).gte('created_at', today.toISOString()).order('created_at', { ascending: false }).limit(20),
        // Compliance items due in the next 7 days
        supabaseAdmin.from('compliance_items').select('title, due_date, item_type').eq('tenant_id', tenant_id).in('status', ['upcoming','due']).gte('due_date', todayStr).lte('due_date', in7Days).order('due_date'),
        // Latest health score
        supabaseAdmin.from('business_health_snapshots').select('overall_score, financial_health, legal_compliance').eq('tenant_id', tenant_id).order('snapshot_date', { ascending: false }).limit(1).maybeSingle(),
      ])

      const staffData = staffRes.data ?? []
      const wellnessAvg = staffData.reduce((sum, s) => {
        const scores = (s.wellness_scores as number[]) ?? []
        const avg = scores.length > 0 ? scores.slice(-7).reduce((a, b) => a + b, 0) / Math.min(scores.length, 7) : 0
        return sum + avg
      }, 0) / (staffData.length || 1)

      const totalDebt = (invoiceRes.data ?? []).reduce((sum, i) => sum + Number(i.amount), 0)

      return {
        tenantName:        tenantRes.data?.name ?? 'your business',
        plan:              tenantRes.data?.plan ?? 'solo',
        openConversations: convRes.data?.length ?? 0,
        overdueInvoices:   invoiceRes.data?.length ?? 0,
        totalDebt,
        staffCount:        staffData.length,
        wellnessAvg:       Math.round(wellnessAvg * 10) / 10,
        activeGoals:       goalRes.data ?? [],
        automationsToday:  wqRes.data?.length ?? 0,
        complianceDue:     complianceRes.data ?? [],
        healthScore:       healthRes.data?.overall_score ?? null,
        legalScore:        healthRes.data?.legal_compliance ?? null,
        language:          tenantRes.data?.language_primary ?? 'en',
      }
    })

    const brief = await step.run('generate-brief', async () => {
      // Use Haiku for Solo/Grow, Sonnet for Operate+ (per MASTER_ROADMAP cost plan)
      const model = getModelForFeature('daily_brief', intelligence.plan)
      const maxTokens = model.includes('sonnet') ? 900 : 600

      const complianceSection = intelligence.complianceDue.length > 0
        ? `\n- Compliance due this week: ${intelligence.complianceDue.map((c: { title: string; due_date: string }) => `${c.title} (${c.due_date})`).join(', ')}`
        : ''

      const healthSection = intelligence.healthScore
        ? `\n- Business Health Score: ${intelligence.healthScore}/100 (Legal: ${intelligence.legalScore ?? '?'}/100)`
        : ''

      const response = await anthropic.messages.create({
        model,
        max_tokens: maxTokens,
        system: [
          {
            type: 'text',
            text: 'You are Langa — a world-class business advisor for South African entrepreneurs. Generate concise, actionable daily briefs. Sections: 1) What happened (data summary), 2) What it means (1–2 sentence interpretation), 3) Compliance this week (if any), 4) One Langa insight (most impactful single action). Be direct, human, and empowering. Speak to the resilience of African entrepreneurs.',
            cache_control: { type: 'ephemeral' },
          },
        ],
        messages: [{
          role: 'user',
          content: `Morning brief for ${intelligence.tenantName}:
- Open conversations: ${intelligence.openConversations}
- Overdue invoices: ${intelligence.overdueInvoices} (R${intelligence.totalDebt.toLocaleString()} outstanding)
- Staff: ${intelligence.staffCount} active, wellness avg: ${intelligence.wellnessAvg}/5
- Active goals: ${intelligence.activeGoals.map((g: { title: string; progress_pct?: number }) => `${g.title} (${Math.round(g.progress_pct ?? 0)}%)`).join(', ') || 'none'}
- Automations run today: ${intelligence.automationsToday}${complianceSection}${healthSection}

Today is ${new Date().toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}. Max ${maxTokens === 900 ? 450 : 300} words.`,
        }],
      })

      return response.content[0].type === 'text' ? response.content[0].text : ''
    })

    await step.run('store-brief', async () => {
      // Surface it (Command Center reads this) + keep the audit trail.
      await setDailyBrief(tenant_id, brief)
      await writeAuditLog({
        tenantId: tenant_id,
        actor: 'insight',
        action: 'daily_brief_generated',
        metadata: { brief, generated_at: new Date().toISOString() },
      })
    })

    return { tenant_id, brief_length: brief.length, status: 'generated' }
  }
)
