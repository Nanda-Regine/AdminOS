import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'
import { withRoute } from '@/lib/api/withRoute'

const schema = z.object({
  userIds: z.array(z.string().uuid()).min(1).max(500),
  title:   z.string().min(1).max(150),
  body:    z.string().min(1).max(500),
  data:    z.record(z.string(), z.unknown()).optional(),
})

interface ExpoMessage {
  to:    string
  title: string
  body:  string
  data?: Record<string, unknown>
}

interface ExpoReceiptError {
  status:  'error'
  message: string
}

interface ExpoReceiptOk {
  status: 'ok'
}

type ExpoReceipt = ExpoReceiptOk | ExpoReceiptError

// Was role-blind until 82e643b: any staff member could push arbitrary text to
// any colleague's phone, looking like an official AdminOS notification.
// broadcasts.send = send_broadcasts (owner/admin by default).
export const POST = withRoute({
  action: 'broadcasts.send',
  body: schema,
  rateLimit: 'api',
}, async ({ ctx, body, audit }) => {
  const { tenantId } = ctx

  // Fetch push tokens for the target users (within this tenant only)
  const { data: tokens } = await supabaseAdmin
    .from('push_tokens')
    .select('token')
    .eq('tenant_id', tenantId)
    .in('user_id', body.userIds)

  if (!tokens || tokens.length === 0) {
    return { sent: 0, message: 'No push tokens found' }
  }

  // Expo Push API — batch up to 100 per request
  const messages: ExpoMessage[] = tokens.map((t) => ({
    to:    t.token,
    title: body.title,
    body:  body.body,
    data:  body.data,
  }))

  const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'
  const BATCH_SIZE    = 100

  let sent   = 0
  let failed = 0

  for (let i = 0; i < messages.length; i += BATCH_SIZE) {
    const batch = messages.slice(i, i + BATCH_SIZE)

    const res = await fetch(EXPO_PUSH_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body:    JSON.stringify(batch),
    })

    if (!res.ok) {
      failed += batch.length
      continue
    }

    const { data: receipts } = (await res.json()) as { data: ExpoReceipt[] }
    for (const receipt of receipts ?? []) {
      if (receipt.status === 'ok') sent++
      else                         failed++
    }
  }

  await audit({
    action: 'push.sent',
    resourceType: 'push_notification',
    metadata: { recipients: body.userIds.length, sent, failed, title: body.title },
  })

  return { sent, failed, total: messages.length }
})
