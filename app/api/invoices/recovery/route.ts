import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requirePermission } from '@/lib/auth/permissions'
import { writeAuditLog, getClientIp } from '@/lib/security/audit'
import { z } from 'zod'

// Debt-recovery owner-review queue.
//
// The recovery engine auto-sends only courteous tiers 1–3. Anything harsher
// (tier 4+) is flagged recovery_status='awaiting_owner_review' and STOPS — the
// owner decides and sends it themselves. This route is what finally surfaces
// those to the owner (the loop was previously written but invisible) and lets
// them act:
//   pause        → recovery_status='paused'         (cron skips it; e.g. disputed)
//   resume       → recovery_status='auto'           (back on the gentle auto track)
//   mark_handled → recovery_status='owner_approved' (owner contacted them directly)
// The cron already excludes paused / awaiting_owner_review / owner_approved.

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.app_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  try { await requirePermission('manage_invoices') } catch {
    return new NextResponse('Forbidden', { status: 403 })
  }

  const { data, error } = await supabaseAdmin
    .from('invoices')
    .select('id, contact_name, contact_phone, contact_email, amount, amount_paid, due_date, days_overdue, recovery_tier, reference, recovery_status')
    .eq('tenant_id', tenantId)
    .eq('recovery_status', 'awaiting_owner_review')
    .order('days_overdue', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ invoices: data ?? [] })
}

const patchSchema = z.object({
  invoiceId: z.string().uuid(),
  action:    z.enum(['pause', 'resume', 'mark_handled']),
})
const STATUS_FOR = { pause: 'paused', resume: 'auto', mark_handled: 'owner_approved' } as const

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.app_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  try { await requirePermission('manage_invoices') } catch {
    return new NextResponse('Forbidden', { status: 403 })
  }

  let body: z.infer<typeof patchSchema>
  try { body = patchSchema.parse(await request.json()) } catch (e) {
    return NextResponse.json({ error: 'Invalid request', detail: e }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('invoices')
    .update({ recovery_status: STATUS_FOR[body.action] })
    .eq('id', body.invoiceId)
    .eq('tenant_id', tenantId)   // scope the mutation to the caller's tenant
    .select('id, recovery_status')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  if (!data) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })

  await writeAuditLog({
    tenantId,
    actor: user.id,
    action: `debt_recovery.${body.action}`,
    resourceType: 'invoice',
    resourceId: body.invoiceId,
    ipAddress: getClientIp(request),
    metadata: { recovery_status: STATUS_FOR[body.action] },
  })

  return NextResponse.json(data)
}
