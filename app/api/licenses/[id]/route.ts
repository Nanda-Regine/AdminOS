import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { withRoute, unwrap, notFound } from '@/lib/api/withRoute'

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const patchSchema = z.object({
  licenseType:         z.string().min(1).max(200).optional(),
  licenseNumber:       z.string().max(100).nullable().optional(),
  issuingBody:         z.string().max(200).nullable().optional(),
  issueDate:           ymd.nullable().optional(),
  expiryDate:          ymd.nullable().optional(),
  renewalReminderDays: z.number().int().min(7).max(365).optional(),
}).refine((b) => Object.keys(b).length > 0, 'Nothing to update')

// PATCH — edit or renew (a new expiry date) the SAME record, so the old one
// doesn't stay "Expired" and keep the stats red.
export const PATCH = withRoute({
  action: 'licences.write',
  body: patchSchema,
  audit: 'licence.updated',
  resourceType: 'professional_licence',
  rateLimit: 'api',
}, async ({ ctx, params, body }) => {
  if (!z.string().uuid().safeParse(params.id).success) throw notFound('Licence not found')

  const updates: Record<string, unknown> = {}
  if (body.licenseType !== undefined)         updates.license_type = body.licenseType
  if (body.licenseNumber !== undefined)       updates.license_number = body.licenseNumber
  if (body.issuingBody !== undefined)         updates.issuing_body = body.issuingBody
  if (body.issueDate !== undefined)           updates.issue_date = body.issueDate
  if (body.expiryDate !== undefined)          updates.expiry_date = body.expiryDate
  if (body.renewalReminderDays !== undefined) updates.renewal_reminder_days = body.renewalReminderDays

  const row = unwrap(await supabaseAdmin
    .from('professional_licenses')
    .update(updates)
    .eq('id', params.id)
    .eq('tenant_id', ctx.tenantId)
    .is('deleted_at', null)
    .select()
    .maybeSingle())
  if (!row) throw notFound('Licence not found')

  // A renewal closes the old reminder; the Monday cron raises the next one
  // when the new reminder window opens.
  if (body.expiryDate) {
    unwrap(await supabaseAdmin
      .from('compliance_items')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('tenant_id', ctx.tenantId)
      .eq('item_type', 'license_renewal')
      .eq('title', `Renew: ${row.license_type}`)
      .neq('status', 'completed'))
  }
  return row
})

// DELETE — soft delete only.
export const DELETE = withRoute({
  action: 'licences.write',
  audit: 'licence.deleted',
  resourceType: 'professional_licence',
  rateLimit: 'api',
}, async ({ ctx, params }) => {
  if (!z.string().uuid().safeParse(params.id).success) throw notFound('Licence not found')
  const row = unwrap(await supabaseAdmin
    .from('professional_licenses')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', params.id)
    .eq('tenant_id', ctx.tenantId)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle())
  if (!row) throw notFound('Licence not found')
  return { ok: true }
})
