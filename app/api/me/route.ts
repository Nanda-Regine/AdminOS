import { supabaseAdmin } from '@/lib/supabase/admin'
import { withRoute, unwrap } from '@/lib/api/withRoute'
import { can } from '@/lib/auth/roleMatrix'
import { OWED_INVOICE_STATUSES, outstanding } from '@/lib/invoices/status'
import { todayDateString } from '@/lib/debt/overdue'

/**
 * GET /api/me — who am I, and what needs me today.
 *
 * The mobile app's single bootstrap call: identity and permissions (it builds
 * its navigation from these — never from a JWT role claim), the caller's own
 * staff record, and a "today" feed. Each management section is present only
 * when the caller holds the permission behind it, so a cleaner's app never
 * receives the business's debtor total.
 *
 * Counts use head/count queries; the overdue sum reads only open invoices'
 * amounts (bounded by the open book, not invoice history).
 */
export const GET = withRoute({ action: 'profile.own' }, async ({ ctx }) => {
  const { tenantId, userId } = ctx
  const today = todayDateString()

  const [tenantRes, userRes, staffRes] = await Promise.all([
    supabaseAdmin.from('tenants').select('id, name, plan').eq('id', tenantId).maybeSingle(),
    supabaseAdmin.auth.admin.getUserById(userId),
    supabaseAdmin
      .from('staff')
      .select('id, full_name, job_title, department, leave_balance, leave_taken')
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .maybeSingle(),
  ])
  const tenant = unwrap(tenantRes)
  const staff = unwrap(staffRes)

  // ── Your own day ──────────────────────────────────────────────────────────
  const mine: Record<string, unknown> = {}
  if (staff) {
    const [tasks, leave, payslip] = await Promise.all([
      supabaseAdmin.from('tasks').select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId).eq('assigned_to', staff.id).is('deleted_at', null)
        .in('status', ['todo', 'in_progress', 'review']),
      supabaseAdmin.from('leave_requests').select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId).eq('staff_id', staff.id).eq('status', 'pending').is('deleted_at', null),
      supabaseAdmin.from('payslips')
        .select('id, net:net_pay, payroll_run:payroll_runs!inner(period_month, period_year, status)')
        .eq('tenant_id', tenantId).eq('staff_id', staff.id).is('deleted_at', null)
        .eq('payroll_run.status', 'paid')
        .order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ])
    mine.openTasks = tasks.count ?? 0
    mine.pendingLeave = leave.count ?? 0
    mine.latestPayslip = unwrap(payslip)
  }

  // ── What needs a decision (management only) ───────────────────────────────
  const decisions: Record<string, unknown> = {}
  const jobs: Promise<void>[] = []

  if (can(ctx, 'leave.approve')) {
    jobs.push((async () => {
      const r = await supabaseAdmin.from('leave_requests').select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId).eq('status', 'pending').is('deleted_at', null)
      decisions.leaveToApprove = r.count ?? 0
    })())
  }
  if (can(ctx, 'expenses.approve')) {
    jobs.push((async () => {
      const r = await supabaseAdmin.from('expenses').select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId).eq('status', 'pending').is('deleted_at', null)
      decisions.expensesToApprove = r.count ?? 0
    })())
  }
  if (can(ctx, 'invoices.read') || can(ctx, 'money.read')) {
    jobs.push((async () => {
      const open = unwrap(await supabaseAdmin.from('invoices')
        .select('amount, amount_paid, due_date')
        .eq('tenant_id', tenantId).is('deleted_at', null)
        .in('status', [...OWED_INVOICE_STATUSES])
        .limit(5000)) ?? []
      let owed = 0, overdue = 0, overdueCount = 0
      for (const inv of open) {
        const o = outstanding(inv)
        owed += o
        if (inv.due_date && inv.due_date < today && o > 0) { overdue += o; overdueCount++ }
      }
      decisions.money = { owed: round2(owed), overdue: round2(overdue), overdueCount }
    })())
  }
  if (can(ctx, 'communications.read')) {
    jobs.push((async () => {
      const r = await supabaseAdmin.from('conversations').select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId).eq('status', 'escalated')
      decisions.escalatedConversations = r.count ?? 0
    })())
  }
  if (can(ctx, 'analytics.read')) {
    jobs.push((async () => {
      const r = await supabaseAdmin.from('business_health_snapshots')
        .select('overall_score, snapshot_date')
        .eq('tenant_id', tenantId).order('snapshot_date', { ascending: false }).limit(1).maybeSingle()
      decisions.health = r.data ?? null
    })())
  }
  await Promise.all(jobs)

  const authUser = userRes.data.user
  return {
    user: { id: userId, email: authUser?.email ?? null, name: staff?.full_name ?? authUser?.user_metadata?.full_name ?? null },
    tenant: tenant ? { id: tenant.id, name: tenant.name, plan: tenant.plan } : { id: tenantId, name: null, plan: null },
    role: ctx.role,
    permissions: ctx.isSuperAdmin ? ['*'] : ctx.permissions,
    staff: staff
      ? {
          id: staff.id,
          fullName: staff.full_name,
          jobTitle: staff.job_title,
          department: staff.department,
          leave: {
            entitlement: Number(staff.leave_balance ?? 0),
            taken: Number(staff.leave_taken ?? 0),
            remaining: Number(staff.leave_balance ?? 0) - Number(staff.leave_taken ?? 0),
          },
        }
      : null,
    mine,
    decisions,
  }
})

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
