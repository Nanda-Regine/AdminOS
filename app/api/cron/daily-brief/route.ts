import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { generateDailyBrief } from '@/lib/ai/callClaude'
import { writeAuditLog } from '@/lib/security/audit'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function GET(request: Request) {
  // Verify Vercel cron secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const { data: tenants } = await supabaseAdmin
    .from('tenants')
    .select('id, name')
    .eq('active', true)

  if (!tenants?.length) {
    return NextResponse.json({ ok: true, processed: 0 })
  }

  let processed = 0
  const errors: string[] = []

  for (const tenant of tenants) {
    try {
      const [convResult, invoiceResult, leaveResult, goalResult, staffResult] =
        await Promise.all([
          supabaseAdmin
            .from('conversations')
            .select('id', { count: 'exact' })
            .eq('tenant_id', tenant.id)
            .eq('status', 'open'),
          supabaseAdmin
            .from('invoices')
            .select('amount')
            .eq('tenant_id', tenant.id)
            .in('status', ['unpaid', 'partial'])
            .gt('days_overdue', 0),
          supabaseAdmin
            .from('leave_requests')
            .select('id', { count: 'exact' })
            .eq('tenant_id', tenant.id)
            .eq('status', 'approved')
            .gte('end_date', new Date().toISOString().split('T')[0]),
          supabaseAdmin
            .from('goals')
            .select('title')
            .eq('tenant_id', tenant.id)
            .eq('status', 'active')
            .limit(3),
          supabaseAdmin
            .from('staff')
            .select('wellness_scores')
            .eq('tenant_id', tenant.id),
        ])

      const totalDebt = (invoiceResult.data || []).reduce(
        (sum, inv) => sum + Number(inv.amount),
        0
      )

      // Calculate avg wellness score from last 7 days
      const sevenDaysAgo = Date.now() - 7 * 24 * 3600 * 1000
      const wellnessScores = (staffResult.data || []).flatMap((s) => {
        const scores =
          (s.wellness_scores as Array<{ score: number; date: string }>) || []
        return scores
          .filter((sc) => new Date(sc.date).getTime() > sevenDaysAgo)
          .map((sc) => sc.score)
      })
      const wellnessAvg =
        wellnessScores.length
          ? wellnessScores.reduce((a, b) => a + b, 0) / wellnessScores.length
          : 0

      const brief = await generateDailyBrief({
        tenantName: tenant.name,
        openConversations: convResult.count || 0,
        overdueInvoices: invoiceResult.data?.length || 0,
        totalDebt,
        staffOnLeave: leaveResult.count || 0,
        wellnessAvg: Math.round(wellnessAvg * 10) / 10,
        topGoals: (goalResult.data || []).map((g) => g.title),
      })

      // Persist the brief in audit log for dashboard display
      await supabaseAdmin.from('audit_log').insert({
        tenant_id: tenant.id,
        actor: 'system',
        action: 'daily_brief.generated',
        metadata: {
          brief,
          stats: {
            open_conversations: convResult.count || 0,
            overdue_invoices: invoiceResult.data?.length || 0,
            total_debt: totalDebt,
            staff_on_leave: leaveResult.count || 0,
            wellness_avg: wellnessAvg,
          },
          generated_at: new Date().toISOString(),
        },
      })

      await writeAuditLog({
        tenantId: tenant.id,
        actor: 'system',
        action: 'cron.daily_brief.completed',
      })

      processed++
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(`${tenant.id}: ${msg}`)
      console.error(`[DailyBrief] Failed for tenant ${tenant.id}:`, err)
    }
  }

  return NextResponse.json({ ok: true, processed, errors })
}
