import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'
import { can } from '@/lib/auth/roleMatrix'
import { withRoute, unwrap, notFound, RouteError } from '@/lib/api/withRoute'
import { ownStaffId, isTenantStaff } from '@/lib/people/ownStaff'

const clockSchema = z.object({
  staffId:      z.string().uuid(),
  eventType:    z.enum(['clock_in', 'clock_out', 'break_start', 'break_end']),
  lat:          z.number().min(-90).max(90).optional(),
  lng:          z.number().min(-180).max(180).optional(),
  locationName: z.string().max(200).optional(),
  deviceId:     z.string().max(100).optional(),
})

const COLUMNS = 'id, staff_id, event_type, timestamp, lat, lng, location_name, device_id, created_at'

const STALE_MS = 16 * 3600_000

// Which event may follow which. Without this, a double-tapped "Clock in"
// recorded two shifts, and "clock out" with no clock-in counted as attendance.
const NEXT: Record<string, ReadonlyArray<string>> = {
  none:        ['clock_in'],
  clock_in:    ['clock_out', 'break_start'],
  break_start: ['break_end'],
  break_end:   ['clock_out', 'break_start'],
  clock_out:   ['clock_in'],
}

/**
 * Who the caller may clock for: HR (staff.write) for anyone in the tenant —
 * kiosk / supervisor clocking; everyone else only for their own linked row.
 * It used to accept any staffId from any member, so a colleague could clock
 * you in (or out) — a payroll-fraud and BCEA-records problem.
 */
async function assertMayActFor(ctx: { tenantId: string; userId: string; permissions: readonly string[]; isSuperAdmin: boolean }, staffId: string) {
  if (can(ctx, 'staff.write')) {
    if (!(await isTenantStaff(ctx.tenantId, staffId))) throw notFound('Staff member not found')
    return
  }
  const own = await ownStaffId(ctx.tenantId, ctx.userId)
  if (own !== staffId) throw new RouteError(403, 'You can only clock in or out for yourself.', 'forbidden')
}

export const POST = withRoute({
  action: 'clock.self',
  body: clockSchema,
  status: 201,
  audit: 'clock.event',
  resourceType: 'clock_event',
  rateLimit: 'api',
}, async ({ ctx, body }) => {
  await assertMayActFor(ctx, body.staffId)

  const last = unwrap(await supabaseAdmin
    .from('clock_events')
    .select('event_type, timestamp')
    .eq('tenant_id', ctx.tenantId)
    .eq('staff_id', body.staffId)
    .order('timestamp', { ascending: false })
    .limit(1)
    .maybeSingle())
  // A shift left open for 16h+ (forgot to clock out) doesn't lock anyone out
  // of today — the missing clock-out shows on the team page for HR to fix.
  const stale = last && Date.now() - new Date(last.timestamp).getTime() > STALE_MS
  const state = !last || stale ? 'none' : last.event_type
  const allowed = NEXT[state] ?? NEXT.none
  if (!allowed.includes(body.eventType)) {
    throw new RouteError(409, `Can't ${body.eventType.replace('_', ' ')} right now — the last entry was ${(last?.event_type ?? 'none').replace('_', ' ')}.`, 'invalid_sequence')
  }

  return unwrap(await supabaseAdmin
    .from('clock_events')
    .insert({
      tenant_id:     ctx.tenantId,
      staff_id:      body.staffId,
      event_type:    body.eventType,
      lat:           body.lat ?? null,
      lng:           body.lng ?? null,
      location_name: body.locationName ?? null,
      device_id:     body.deviceId ?? null,
    })
    .select(COLUMNS)
    .single(), { required: true })
})

const listQuery = z.object({
  staffId: z.string().uuid().optional(),
  from:    z.string().datetime({ offset: true }).optional(),
  to:      z.string().datetime({ offset: true }).optional(),
})

// GET /api/staff/clock — HR sees everyone; a member sees only their own events.
// (It returned the whole team's GPS-tagged attendance to any member.)
export const GET = withRoute({ action: 'clock.self', query: listQuery }, async ({ ctx, query }) => {
  let staffId = query.staffId
  if (!can(ctx, 'staff.read')) {
    const own = await ownStaffId(ctx.tenantId, ctx.userId)
    if (!own) return []
    staffId = own
  }

  let q = supabaseAdmin
    .from('clock_events')
    .select(COLUMNS)
    .eq('tenant_id', ctx.tenantId)
    .order('timestamp', { ascending: false })
    .limit(200)

  if (staffId)    q = q.eq('staff_id', staffId)
  if (query.from) q = q.gte('timestamp', query.from)
  if (query.to)   q = q.lte('timestamp', query.to)

  return unwrap(await q) ?? []
})
