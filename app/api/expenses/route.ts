import { supabaseAdmin } from '@/lib/supabase/admin'
import { notifyTenant } from '@/lib/notifications/notify'
import { can } from '@/lib/auth/roleMatrix'
import { z } from 'zod'
import { withRoute, unwrap, notFound, badRequest, RouteError } from '@/lib/api/withRoute'
import { isTenantReceiptRef } from '@/lib/expenses/receipts'
import { pushToUsers, usersWithPermission } from '@/lib/notifications/push'
import { after } from 'next/server'
import { ownStaffId } from '@/lib/people/ownStaff'

const listQuery = z.object({
  status:  z.enum(['pending', 'approved', 'rejected', 'paid']).optional(),
  staffId: z.string().uuid().optional(),
})

// GET /api/expenses — finance sees every claim; everyone else only their own.
// It used to return the whole team's claims to any logged-in member.
export const GET = withRoute({ action: 'expenses.submit', query: listQuery }, async ({ ctx, query }) => {
  let q = supabaseAdmin
    .from('expenses')
    .select('id, staff_id, amount, category, description, receipt_url, status, submitted_at, approved_at, paid_at, staff(full_name, job_title)')
    .eq('tenant_id', ctx.tenantId)
    .is('deleted_at', null)
    .order('submitted_at', { ascending: false })
    .limit(200)

  if (!can(ctx, 'expenses.read_all')) {
    const own = await ownStaffId(ctx.tenantId, ctx.userId)
    if (!own) return []
    q = q.eq('staff_id', own)
  } else if (query.staffId) {
    q = q.eq('staff_id', query.staffId)
  }
  if (query.status) q = q.eq('status', query.status)

  return unwrap(await q) ?? []
})

const createSchema = z.object({
  staffId:     z.string().uuid(),
  amount:      z.number().positive().max(10_000_000),
  category:    z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  // https only: the finance page renders this as a link, and z.url() alone
  // accepts javascript: URLs.
  receiptUrl:  z.string().url().max(2000).refine((u) => u.startsWith('https://'), 'Must be an https:// link').optional(),
  /** From POST /api/expenses/receipt (staff app camera upload). */
  receiptRef:  z.string().max(200).optional(),
})

// POST /api/expenses — submit a claim. Finance may file on anyone's behalf
// (staff mostly have no login yet); everyone else only for themselves. It used
// to accept any staffId from any member, so anyone could file claims as a colleague.
export const POST = withRoute({
  action: 'expenses.submit',
  body: createSchema,
  status: 201,
  audit: 'expense.submitted',
  resourceType: 'expense',
  rateLimit: 'api',
}, async ({ ctx, body }) => {
  const { tenantId, userId } = ctx

  if (!can(ctx, 'expenses.read_all')) {
    const own = await ownStaffId(tenantId, userId)
    if (own !== body.staffId) throw new RouteError(403, 'You can only submit expense claims for yourself.', 'forbidden')
  }

  if (body.receiptRef && !isTenantReceiptRef(body.receiptRef, tenantId)) {
    throw badRequest('That receipt upload was not found — please attach it again.')
  }

  unwrap(await supabaseAdmin
    .from('staff')
    .select('id')
    .eq('id', body.staffId)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .maybeSingle(), { required: true, what: 'Staff member not found' })

  const data = unwrap(await supabaseAdmin
    .from('expenses')
    .insert({
      tenant_id:   tenantId,
      staff_id:    body.staffId,
      amount:      body.amount,
      category:    body.category,
      description: body.description ?? null,
      receipt_url: body.receiptRef ?? body.receiptUrl ?? null,
    })
    .select()
    .single())
  if (!data) throw notFound()

  // Push the owner: an approval is waiting (People cockpit surfaces it too).
  await notifyTenant(tenantId, {
    type: 'approval.needed',
    title: 'Expense to approve',
    body: `A new expense claim for R${Number(body.amount).toLocaleString('en-ZA')}${body.category ? ` (${body.category})` : ''} is waiting for your approval.`,
    actionUrl: '/dashboard/expenses',
    dedupeKey: `expense-${data.id}`,
    whatsapp: true,
  })

  // …and the approvers' phones (finance, minus the claimant).
  after(async () => {
    const approvers = (await usersWithPermission(tenantId, 'view_financials')).filter((id) => id !== userId)
    await pushToUsers(tenantId, approvers, {
      title: 'Expense to approve',
      body: `R${Number(body.amount).toLocaleString('en-ZA')} — ${body.category}`,
      route: '/approvals',
    })
  })

  return data
})
