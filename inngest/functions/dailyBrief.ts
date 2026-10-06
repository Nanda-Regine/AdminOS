import { inngest } from '@/inngest/client'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { writeAuditLog } from '@/lib/security/audit'
import { checkBudget, recordUsage, getModelForFeature } from '@/lib/ai/costControls'
import { setDailyBrief } from '@/lib/signals/brief'
import { OPEN_INVOICE_STATUSES, outstanding } from '@/lib/invoices/status'
import { todayDateString } from '@/lib/debt/overdue'
import Anthropic from '@anthropic-ai/sdk'
import { recentWellnessAvg } from '@/lib/people/wellness'
import { sastDate, sastDayStartUTC } from '@/lib/time/sast'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export const dailyBriefEngine = inngest.createFunction(
  { id: 'daily-brief-engine', retries: 2, triggers: [{ event: 'adminos/brief.generate' }] },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async ({ event, step }: any) => {
    const { tenant_id } = event.data as { tenant_id: string }

    const intelligence = await step.run('aggregate-data', async () => {
      const todayStr = sastDate()
      const in7Days  = sastDate(new Date(Date.now() + 7 * 86400000))

      const [tenantRes, convRes, invoiceRes, staffRes, goalRes, wqRes, complianceRes, healthRes] = await Promise.all([
        supabaseAdmin.from('tenants').select('name, plan, settings, language_primary').eq('id', tenant_id).single(),
        supabaseAdmin.from('conversations').select('id, status, intent, sentiment').eq('tenant_id', tenant_id).eq('status', 'open'),
        // Open + past due by due_date (days_overdue is a stale trigger column; see lib/invoices/status).
        supabaseAdmin.from('invoices').select('amount, amount_paid').eq('tenant_id', tenant_id).in('status', [...OPEN_INVOICE_STATUSES]).lt('due_date', todayDateString()).is('deleted_at', null),
        supabaseAdmin.from('staff').select('id, full_name, wellness_scores').is('deleted_at', null).eq('tenant_id', tenant_id).eq('active', true),
        supabaseAdmin.from('goals').select('title, progress_pct, status').is('deleted_at', null).eq('tenant_id', tenant_id).eq('status', 'active').limit(5),
        supabaseAdmin.from('workflow_queue').select('workflow_type, status, created_at').eq('tenant_id', tenant_id).gte('created_at', sastDayStartUTC()).order('created_at', { ascending: false }).limit(20),
        // Compliance items due in the next 7 days
        supabaseAdmin.from('compliance_items').select('title, due_date, item_type').is('deleted_at', null).eq('tenant_id', tenant_id).in('status', ['upcoming','due']).gte('due_date', todayStr).lte('due_date', in7Days).order('due_date'),
        // Latest health score
        supabaseAdmin.from('business_health_snapshots').select('overall_score, financial_health, legal_compliance').eq('tenant_id', tenant_id).order('snapshot_date', { ascending: false }).limit(1).maybeSingle(),
      ])

      const staffData = staffRes.data ?? []
      // wellness_scores holds { score, date } objects — summing them as numbers
      // gave NaN. Average only staff who have checked in (a 0 for everyone
      // else dragged the team score down).
      const perPerson = staffData.map((s) => recentWellnessAvg(s.wellness_scores)).filter((v): v is number => v !== null)
      const wellnessAvg = perPerson.length ? perPerson.reduce((a, b) => a + b, 0) / perPerson.length : 0

      const totalDebt = (invoiceRes.data ?? []).reduce((sum, i) => sum + outstanding(i), 0)

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

      // Budget check — this runs nightly for every tenant, so it must be metered
      // like any other AI call. A blocked check skips the brief for today rather
      // than throwing; store-brief below logs the deferral instead of a brief.
      const budget = await checkBudget(tenant_id, intelligence.plan, maxTokens)
      if (!budget.allowed) {
        console.warn(`[AI:blocked] tenant=${tenant_id} feature=daily_brief reason=${budget.reason}`)
        return null
      }

      const t0 = Date.now()

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
- Staff: ${intelligence.staffCount} active, wellness avg: ${intelligence.wellnessAvg ? `${intelligence.wellnessAvg}/5` : "no check-ins yet"}
- Active goals: ${intelligence.activeGoals.map((g: { title: string; progress_pct?: number }) => `${g.title} (${Math.round(g.progress_pct ?? 0)}%)`).join(', ') || 'none'}
- Automations run today: ${intelligence.automationsToday}${complianceSection}${healthSection}

Today is ${new Date().toLocaleDateString('en-ZA', { timeZone: 'Africa/Johannesburg', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}. Max ${maxTokens === 900 ? 450 : 300} words.`,
        }],
      })

      const text = response.content[0].type === 'text' ? response.content[0].text : ''

      void recordUsage({
        tenantId:   tenant_id,
        plan:       intelligence.plan,
        feature:    'daily_brief',
        model,
        tokensIn:   response.usage.input_tokens,
        tokensOut:  response.usage.output_tokens,
        durationMs: Date.now() - t0,
      })

      return text
    })

    await step.run('store-brief', async () => {
      if (!brief) {
        await writeAuditLog({
          tenantId: tenant_id,
          actor: 'insight',
          action: 'daily_brief_deferred_budget',
          metadata: { generated_at: new Date().toISOString() },
        })
        return
      }
      // Surface it (Command Center reads this) + keep the audit trail.
      await setDailyBrief(tenant_id, brief)
      await writeAuditLog({
        tenantId: tenant_id,
        actor: 'insight',
        action: 'daily_brief_generated',
        metadata: { brief, generated_at: new Date().toISOString() },
      })
    })

    return { tenant_id, brief_length: brief?.length ?? 0, status: brief ? 'generated' : 'deferred_budget' }
  }
)
