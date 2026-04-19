import { inngest } from '@/inngest/client'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { writeAuditLog } from '@/lib/security/audit'
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

      const [tenantRes, convRes, invoiceRes, staffRes, goalRes, wqRes] = await Promise.all([
        supabaseAdmin.from('tenants').select('name, settings, language_primary').eq('id', tenant_id).single(),
        supabaseAdmin.from('conversations').select('id, status, intent, sentiment').eq('tenant_id', tenant_id).eq('status', 'open'),
        supabaseAdmin.from('invoices').select('amount, days_overdue, status').eq('tenant_id', tenant_id).in('status', ['unpaid', 'partial']).gt('days_overdue', 0),
        supabaseAdmin.from('staff').select('id, full_name, wellness_scores').eq('tenant_id', tenant_id).eq('status', 'active'),
        supabaseAdmin.from('goals').select('title, progress_pct, status').eq('tenant_id', tenant_id).eq('status', 'active').limit(5),
        supabaseAdmin.from('workflow_queue').select('workflow_type, status, created_at').eq('tenant_id', tenant_id).gte('created_at', today.toISOString()).order('created_at', { ascending: false }).limit(20),
      ])

      const staffData = staffRes.data ?? []
      const wellnessAvg = staffData.reduce((sum, s) => {
        const scores = (s.wellness_scores as number[]) ?? []
        const avg = scores.length > 0 ? scores.slice(-7).reduce((a, b) => a + b, 0) / Math.min(scores.length, 7) : 0
        return sum + avg
      }, 0) / (staffData.length || 1)

      const totalDebt = (invoiceRes.data ?? []).reduce((sum, i) => sum + Number(i.amount), 0)

      return {
        tenantName: tenantRes.data?.name ?? 'your business',
        openConversations: convRes.data?.length ?? 0,
        overdueInvoices: invoiceRes.data?.length ?? 0,
        totalDebt,
        staffCount: staffData.length,
        wellnessAvg: Math.round(wellnessAvg * 10) / 10,
        activeGoals: goalRes.data ?? [],
        automationsToday: wqRes.data?.length ?? 0,
        language: tenantRes.data?.language_primary ?? 'en',
      }
    })

    const brief = await step.run('generate-brief', async () => {
      const response = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 600,
        system: [
          {
            type: 'text',
            text: 'You are a world-class business advisor for South African SMEs. Generate concise, actionable daily briefs. Be direct and data-driven. Always end with "Top 3 actions for today:" followed by 3 specific actions.',
            cache_control: { type: 'ephemeral' },
          },
        ],
        messages: [{
          role: 'user',
          content: `Generate a morning brief for ${intelligence.tenantName}:
- Open conversations: ${intelligence.openConversations}
- Overdue invoices: ${intelligence.overdueInvoices} (R${intelligence.totalDebt.toLocaleString()} outstanding)
- Staff: ${intelligence.staffCount} active, wellness avg: ${intelligence.wellnessAvg}/5
- Active goals: ${intelligence.activeGoals.map((g: { title: string; progress_pct?: number }) => `${g.title} (${Math.round(g.progress_pct ?? 0)}%)`).join(', ') || 'none'}
- Automations run today: ${intelligence.automationsToday}

Max 300 words. Today is ${new Date().toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}.`,
        }],
      })

      return response.content[0].type === 'text' ? response.content[0].text : ''
    })

    await step.run('store-brief', async () => {
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
