import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'
import { withRoute, unwrap, notFound, conflict } from '@/lib/api/withRoute'
import { isTenantStaff } from '@/lib/people/ownStaff'

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use a 24-hour time like 08:30')

const createSchema = z.object({
  staffId:   z.string().uuid(),
  shiftDate: isoDate,
  startTime: hhmm,
  endTime:   hhmm,
  location:  z.string().max(200).optional(),
  notes:     z.string().max(500).optional(),
}).refine((s) => s.startTime !== s.endTime, { path: ['endTime'], message: 'A shift must end at a different time than it starts' })

const listQuery = z.object({
  from:    isoDate.optional(),
  to:      isoDate.optional(),
  staffId: z.string().uuid().optional(),
})

const COLUMNS = 'id, staff_id, shift_date, start_time, end_time, location, notes, status, created_at'

/** Minutes since midnight; an end at/before the start means the shift runs overnight. */
const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))
function span(start: string, end: string): [number, number] {
  const s = mins(start)
  let e = mins(end)
  if (e <= s) e += 24 * 60
  return [s, e]
}

// GET — the roster is visible to the whole team (names + times only).
export const GET = withRoute({ action: 'shifts.read', query: listQuery }, async ({ ctx, query }) => {
  let q = supabaseAdmin
    .from('shifts')
    .select(`${COLUMNS}, staff(full_name, job_title)`)
    .eq('tenant_id', ctx.tenantId)
    .is('deleted_at', null)
    .order('shift_date', { ascending: true })
    .order('start_time', { ascending: true })
    .limit(1000)
  if (query.from)    q = q.gte('shift_date', query.from)
  if (query.to)      q = q.lte('shift_date', query.to)
  if (query.staffId) q = q.eq('staff_id', query.staffId)
  return unwrap(await q) ?? []
})

// POST — HR builds the roster. It was open to every member, so anyone could
// put shifts on a colleague.
export const POST = withRoute({
  action: 'shifts.write',
  body: createSchema,
  status: 201,
  audit: 'shift.created',
  resourceType: 'shift',
}, async ({ ctx, body }) => {
  if (!(await isTenantStaff(ctx.tenantId, body.staffId))) throw notFound('Staff member not found')

  // Same person, same day, overlapping hours = a double-booking (and double
  // pay if the roster feeds payroll).
  const sameDay = unwrap(await supabaseAdmin
    .from('shifts')
    .select('start_time, end_time')
    .eq('tenant_id', ctx.tenantId)
    .eq('staff_id', body.staffId)
    .eq('shift_date', body.shiftDate)
    .is('deleted_at', null)) ?? []
  const [ns, ne] = span(body.startTime, body.endTime)
  const clash = sameDay.find((s) => {
    const [es, ee] = span(String(s.start_time).slice(0, 5), String(s.end_time).slice(0, 5))
    return ns < ee && es < ne
  })
  if (clash) throw conflict(`This person already has a shift ${String(clash.start_time).slice(0, 5)}–${String(clash.end_time).slice(0, 5)} that day.`)

  return unwrap(await supabaseAdmin
    .from('shifts')
    .insert({
      tenant_id:  ctx.tenantId,
      staff_id:   body.staffId,
      shift_date: body.shiftDate,
      start_time: body.startTime,
      end_time:   body.endTime,
      location:   body.location ?? null,
      notes:      body.notes ?? null,
      created_by: ctx.userId,
    })
    .select(COLUMNS)
    .single(), { required: true })
})
