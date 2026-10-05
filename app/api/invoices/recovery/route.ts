import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'
import { OPEN_INVOICE_STATUSES } from '@/lib/invoices/status'
import { withRoute, unwrap } from '@/lib/api/withRoute'

// Debt-recovery owner-review queue.
//
// The recovery engine auto-sends only courteous tiers 1–3. Anything harsher
// (tier 4+) is flagged recovery_status='awaiting_owner_review' and STOPS — the
// owner decides and sends it themselves. This route surfaces those to the
// owner and lets them act:
//   pause        → recovery_status='paused'         (cron skips it; e.g. disputed)
//   resume       → recovery_status='auto'           (back on the gentle auto track)
//   mark_handled → recovery_status='owner_approved' (owner contacted them directly)
// The cron already excludes paused / awaiting_owner_review / owner_approved.

export const GET = withRoute({ action: 'invoices.read' }, async ({ ctx }) => {
  const invoices = unwrap(await supabaseAdmin
    .from('invoices')
    .select('id, contact_name, contact_phone, contact_email, amount, amount_paid, due_date, recovery_tier, reference, recovery_status')
    .eq('tenant_id', ctx.tenantId)
    .eq('recovery_status', 'awaiting_owner_review')
    // Only still-open invoices: one paid or cancelled after it was flagged
    // used to sit in the review queue indefinitely.
    .in('status', [...OPEN_INVOICE_STATUSES])
    .is('deleted_at', null)
    // Oldest due date first (= most overdue). This ordered by the stale
    // days_overdue column.
    .order('due_date', { ascending: true })
    .limit(100))
  return { invoices: invoices ?? [] }
})

const patchSchema = z.object({
  invoiceId: z.string().uuid(),
  action:    z.enum(['pause', 'resume', 'mark_handled']),
})
const STATUS_FOR = { pause: 'paused', resume: 'auto', mark_handled: 'owner_approved' } as const

export const PATCH = withRoute({
  action: 'invoices.write',
  body: patchSchema,
}, async ({ ctx, body, audit }) => {
  const data = unwrap(await supabaseAdmin
    .from('invoices')
    .update({ recovery_status: STATUS_FOR[body.action] })
    .eq('id', body.invoiceId)
    .eq('tenant_id', ctx.tenantId)   // scope the mutation to the caller's tenant
    .is('deleted_at', null)
    .select('id, recovery_status')
    .maybeSingle(), { required: true, what: 'Invoice not found' })

  await audit({
    action: `debt_recovery.${body.action}`,
    resourceType: 'invoice',
    resourceId: body.invoiceId,
    metadata: { recovery_status: STATUS_FOR[body.action] },
  })

  return data
})
