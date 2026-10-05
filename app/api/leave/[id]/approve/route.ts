import { withRoute, RouteError } from '@/lib/api/withRoute'
import { decideLeave, backToPage, isFormPost } from '@/lib/people/leave'

// POST /api/leave/[id]/approve — see lib/people/leave.ts for what was fixed.
export const POST = withRoute({
  action: 'leave.approve',
  resourceType: 'leave_request',
}, async ({ request, ctx, params, audit }) => {
  const form = isFormPost(request)
  try {
    const result = await decideLeave(ctx, params.id, 'approved')
    // Audited here, not via config: a form post's 303 isn't response.ok.
    await audit({ action: 'leave.approved', resourceType: 'leave_request', resourceId: params.id })
    return form ? backToPage(request) : result
  } catch (e) {
    if (form && e instanceof RouteError && e.status < 500) return backToPage(request, e.message)
    throw e
  }
})
