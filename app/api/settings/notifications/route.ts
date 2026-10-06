import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { withRoute, unwrap } from '@/lib/api/withRoute'

/**
 * Owner notification controls, persisted in tenants.settings:
 *   - settings.quiet_hours = { start, end }  (minutes since midnight, SAST)
 *   - settings.notify[type].whatsapp = bool  (per-type WhatsApp opt-out)
 * GET returns the current values; POST merges a single change in.
 */
async function readSettings(tenantId: string) {
  const row = unwrap(await supabaseAdmin.from('tenants').select('settings').eq('id', tenantId).maybeSingle())
  return { ...((row?.settings ?? {}) as Record<string, unknown>) }
}

export const GET = withRoute({ action: 'settings.read' }, async ({ ctx }) => {
  const settings = await readSettings(ctx.tenantId)
  return { quietHours: settings.quiet_hours ?? null, notify: settings.notify ?? {} }
})

const minute = z.number().int().min(0).max(1439)
const schema = z.object({
  quietHours: z.object({ start: minute, end: minute }).nullable().optional(),
  // Notification type keys look like 'recovery.sent', 'payroll_due'.
  type:       z.string().regex(/^[a-z0-9_.]{1,60}$/).optional(),
  whatsapp:   z.boolean().optional(),
}).refine((b) => (b.type === undefined) === (b.whatsapp === undefined), { message: 'type and whatsapp go together', path: ['type'] })

export const POST = withRoute({
  action: 'settings.write',
  body: schema,
  audit: 'settings.notifications_changed',
  resourceType: 'tenant',
}, async ({ ctx, body }) => {
  // Read-merge-write so unrelated settings keys are never clobbered.
  const settings = await readSettings(ctx.tenantId)
  if (body.quietHours === null) delete settings.quiet_hours
  else if (body.quietHours) settings.quiet_hours = body.quietHours
  if (body.type !== undefined && body.whatsapp !== undefined) {
    const notify = { ...((settings.notify ?? {}) as Record<string, { whatsapp?: boolean }>) }
    notify[body.type] = { ...notify[body.type], whatsapp: body.whatsapp }
    settings.notify = notify
  }
  unwrap(await supabaseAdmin.from('tenants').update({ settings }).eq('id', ctx.tenantId))
  return { id: ctx.tenantId, ok: true }
})
