import { z } from 'zod'
import { withRoute, RouteError } from '@/lib/api/withRoute'
import { enrolInSequence, ENROL_MESSAGES } from '@/lib/reach/sequences'

export const runtime = 'nodejs'

const schema = z.object({ phone: z.string().trim().min(7).max(30) })

const STATUS = { not_found: 404, inactive: 409, no_steps: 409, bad_phone: 400, no_consent: 422, already_enrolled: 409 } as const

// POST /api/sequences/[id]/enroll { phone } — the Enrol button on a sequence.
export const POST = withRoute({
  action: 'broadcasts.send',
  body: schema,
  audit: 'sequence.enrolled',
  resourceType: 'sequence_enrollment',
  status: 201,
}, async ({ ctx, body, params }) => {
  const r = await enrolInSequence(ctx.tenantId, params.id, body.phone)
  if (!r.ok) throw new RouteError(STATUS[r.reason], ENROL_MESSAGES[r.reason], r.reason)
  return { id: r.id }
})
