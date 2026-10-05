import { z } from 'zod'
import { withRoute } from '@/lib/api/withRoute'
import { pushToUsers } from '@/lib/notifications/push'

const schema = z.object({
  userIds: z.array(z.string().uuid()).min(1).max(500),
  title:   z.string().min(1).max(150),
  body:    z.string().min(1).max(500),
  data:    z.record(z.string(), z.unknown()).optional(),
})

// Was role-blind until 82e643b: any staff member could push arbitrary text to
// any colleague's phone, looking like an official AdminOS notification.
// broadcasts.send = send_broadcasts (owner/admin by default). Tokens are
// looked up within this tenant only, so foreign user ids reach nobody.
export const POST = withRoute({
  action: 'broadcasts.send',
  body: schema,
  rateLimit: 'api',
}, async ({ ctx, body, audit }) => {
  const result = await pushToUsers(ctx.tenantId, body.userIds, {
    title: body.title,
    body:  body.body,
    data:  body.data,
  })

  await audit({
    action: 'push.sent',
    resourceType: 'push_notification',
    metadata: { recipients: body.userIds.length, ...result, title: body.title },
  })

  return result.total === 0 ? { ...result, message: 'No push tokens found' } : result
})
