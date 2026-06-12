import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'

const schema = z.object({
  userIds: z.array(z.string().uuid()).min(1).max(500),
  title:   z.string().min(1).max(150),
  body:    z.string().min(1).max(500),
  data:    z.record(z.unknown()).optional(),
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

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.user_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  let body: z.infer<typeof schema>
  try {
    body = schema.parse(await request.json())
  } catch (e) {
    return NextResponse.json({ error: 'Invalid request', detail: e }, { status: 400 })
  }

  // Fetch push tokens for the target users (within this tenant only)
  const { data: tokens } = await supabaseAdmin
    .from('push_tokens')
    .select('token')
    .eq('tenant_id', tenantId)
    .in('user_id', body.userIds)

  if (!tokens || tokens.length === 0) {
    return NextResponse.json({ sent: 0, message: 'No push tokens found' })
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

  return NextResponse.json({ sent, failed, total: messages.length })
}
