import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { withRoute, unwrap } from '@/lib/api/withRoute'

// Expo push tokens look like ExponentPushToken[xxxxxxxx]. Anything else is
// rejected so a caller can't plant an arbitrary string that we later POST to
// Expo on their colleagues' behalf.
const schema = z.object({
  token:    z.string().regex(/^Expo(nent)?PushToken\[[A-Za-z0-9_-]{10,200}\]$/, 'Not an Expo push token'),
  platform: z.enum(['ios', 'android', 'web']),
})

// POST /api/push/register — the app calls this on every launch. Upsert by
// (user_id, token); a token Expo had reported dead is revived on re-register.
export const POST = withRoute({
  action: 'notifications.own',
  body: schema,
  rateLimit: 'api',
}, async ({ ctx, body }) => {
  // A device token belongs to one login at a time: if someone else signed in
  // on this phone before, stop sending their notifications here.
  unwrap(await supabaseAdmin
    .from('push_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('token', body.token)
    .neq('user_id', ctx.userId)
    .is('revoked_at', null))

  unwrap(await supabaseAdmin
    .from('push_tokens')
    .upsert({
      user_id:    ctx.userId,
      tenant_id:  ctx.tenantId,
      token:      body.token,
      platform:   body.platform,
      revoked_at: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,token' }))

  return { ok: true }
})

// DELETE /api/push/register — sign-out: stop pushing to this device.
export const DELETE = withRoute({
  action: 'notifications.own',
  body: schema.pick({ token: true }),
}, async ({ ctx, body }) => {
  unwrap(await supabaseAdmin
    .from('push_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('user_id', ctx.userId)
    .eq('token', body.token))
  return { ok: true }
})
