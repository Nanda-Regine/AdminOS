import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'
import { notifyTenant } from '@/lib/notifications/notify'
import { withRoute, unwrap, notFound, badRequest } from '@/lib/api/withRoute'

// Columns verified against the live schema 2026-10-05. The old schema wrote
// `emergency_contact` and `bank_branch_code`, which don't exist — any update
// that included either failed with a raw PostgREST error.
const patchSchema = z.object({
  phone:                   z.string().max(30).optional(),
  emergency_contact_name:  z.string().max(200).optional(),
  emergency_contact_phone: z.string().max(30).optional(),
  bank_account_number:     z.string().regex(/^\d{6,16}$/, 'Account number must be 6–16 digits').optional(),
  bank_name:               z.string().max(100).optional(),
  address:                 z.string().max(500).optional(),
}).strict()

const OWN_COLUMNS =
  'id, full_name, email, phone, job_title, department, role, employment_type, start_date, ' +
  'leave_balance, leave_taken, emergency_contact_name, emergency_contact_phone, address, bank_name, bank_account_number'

async function ownRow(tenantId: string, userId: string) {
  return unwrap(await supabaseAdmin
    .from('staff')
    .select('id, full_name, bank_account_number, bank_name')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .maybeSingle())
}

// GET /api/staff/my-profile — the caller's own staff record.
export const GET = withRoute({ action: 'profile.own' }, async ({ ctx }) => {
  const row = unwrap(await supabaseAdmin
    .from('staff')
    .select(OWN_COLUMNS)
    .eq('tenant_id', ctx.tenantId)
    .eq('user_id', ctx.userId)
    .is('deleted_at', null)
    .maybeSingle())
  if (!row) throw notFound('Staff record not found')
  return row
})

// PATCH /api/staff/my-profile — update own contact and banking details.
export const PATCH = withRoute({
  action: 'profile.own',
  body: patchSchema,
  resourceType: 'staff',
  rateLimit: 'api',
}, async ({ ctx, body, audit }) => {
  const existing = await ownRow(ctx.tenantId, ctx.userId)
  if (!existing) throw notFound('Staff record not found')

  const updates = Object.fromEntries(Object.entries(body).filter(([, v]) => v !== undefined))
  if (Object.keys(updates).length === 0) throw badRequest('No updatable fields provided')

  const data = unwrap(await supabaseAdmin
    .from('staff')
    .update(updates)
    .eq('id', existing.id)
    .eq('tenant_id', ctx.tenantId)
    .select(OWN_COLUMNS)
    .single(), { required: true })

  const bankChanged =
    (body.bank_account_number !== undefined && body.bank_account_number !== existing.bank_account_number) ||
    (body.bank_name !== undefined && body.bank_name !== existing.bank_name)

  await audit({
    action: bankChanged ? 'staff.bank_details_changed' : 'staff.profile_updated',
    resourceType: 'staff',
    resourceId: existing.id,
    metadata: { fields: Object.keys(updates) },
  })

  // Changing where your salary goes is the classic payroll-diversion fraud
  // (a phished login redirects the next pay run). Tell the employer every time.
  if (bankChanged) {
    await notifyTenant(ctx.tenantId, {
      type: 'security.alert',
      title: 'Bank details changed',
      body: `${existing.full_name} changed the bank account their salary is paid into. Confirm with them in person before the next payroll run.`,
      actionUrl: `/dashboard/staff/${existing.id}`,
      whatsapp: true,
    })
  }

  return data
})
