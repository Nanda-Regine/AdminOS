import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import crypto from 'crypto'

// Meta Social Inbox Webhook
// Handles Facebook Page messages, Instagram DMs, and comment notifications
// Configured in Meta App Dashboard under Webhooks

// GET — Meta webhook verification (hub.challenge)
export async function GET(request: Request) {
  const url         = new URL(request.url)
  const mode        = url.searchParams.get('hub.mode')
  const token       = url.searchParams.get('hub.verify_token')
  const challenge   = url.searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === process.env.META_WEBHOOK_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 })
  }

  return new NextResponse('Forbidden', { status: 403 })
}

// POST — receive webhook events from Meta
export async function POST(request: Request) {
  const body = await request.text()

  // Verify Meta webhook signature
  const signature = request.headers.get('x-hub-signature-256')
  if (!signature || !process.env.META_APP_SECRET) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  const expectedSignature = `sha256=${crypto
    .createHmac('sha256', process.env.META_APP_SECRET)
    .update(body)
    .digest('hex')}`

  if (signature !== expectedSignature) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  let payload: Record<string, unknown>
  try { payload = JSON.parse(body) } catch {
    return new NextResponse('Bad Request', { status: 400 })
  }

  const object = payload.object as string

  if (object === 'page') {
    // Facebook page messages/comments
    await handleFacebookWebhook(payload)
  } else if (object === 'instagram') {
    // Instagram DMs and comments
    await handleInstagramWebhook(payload)
  }

  // Always return 200 immediately (Meta retries on non-200)
  return new NextResponse('EVENT_RECEIVED', { status: 200 })
}

async function handleFacebookWebhook(payload: Record<string, unknown>) {
  const entries = (payload.entry as Record<string, unknown>[]) ?? []

  for (const entry of entries) {
    const pageId  = entry.id as string
    const changes = (entry.changes as Record<string, unknown>[]) ?? []
    const messaging = (entry.messaging as Record<string, unknown>[]) ?? []

    // Find which tenant owns this Facebook page
    const { data: account } = await supabaseAdmin
      .from('social_accounts')
      .select('tenant_id')
      .eq('platform', 'facebook')
      .eq('account_id', pageId)
      .maybeSingle()

    if (!account) continue

    // Process direct messages
    for (const msg of messaging) {
      const message    = msg.message as Record<string, unknown>
      const sender     = msg.sender as Record<string, unknown>
      if (!message || !sender) continue

      await supabaseAdmin
        .from('social_messages')
        .upsert({
          tenant_id:          account.tenant_id,
          platform:           'facebook',
          external_message_id: String(message.mid ?? ''),
          sender_name:        null,
          sender_id:          String(sender.id ?? ''),
          content:            String(message.text ?? '[media]'),
          message_type:       'dm',
          created_at:         new Date().toISOString(),
        }, { onConflict: 'platform,external_message_id' })
    }

    // Process page comment changes
    for (const change of changes) {
      const value = change.value as Record<string, unknown>
      if (change.field !== 'feed' || !value) continue
      if (!['comment','reply'].includes(String(value.item))) continue

      await supabaseAdmin
        .from('social_messages')
        .upsert({
          tenant_id:          account.tenant_id,
          platform:           'facebook',
          external_message_id: String(value.comment_id ?? value.reaction_id ?? Date.now()),
          sender_name:        (value.from as Record<string, unknown>)?.name as string ?? null,
          sender_id:          String((value.from as Record<string, unknown>)?.id ?? ''),
          content:            String(value.message ?? ''),
          message_type:       'comment',
          created_at:         new Date().toISOString(),
        }, { onConflict: 'platform,external_message_id' })
    }
  }
}

async function handleInstagramWebhook(payload: Record<string, unknown>) {
  const entries = (payload.entry as Record<string, unknown>[]) ?? []

  for (const entry of entries) {
    const igAccountId = entry.id as string
    const messaging   = (entry.messaging as Record<string, unknown>[]) ?? []

    const { data: account } = await supabaseAdmin
      .from('social_accounts')
      .select('tenant_id')
      .eq('platform', 'instagram')
      .eq('account_id', igAccountId)
      .maybeSingle()

    if (!account) continue

    for (const msg of messaging) {
      const message = msg.message as Record<string, unknown>
      const sender  = msg.sender  as Record<string, unknown>
      if (!message || !sender) continue

      await supabaseAdmin
        .from('social_messages')
        .upsert({
          tenant_id:          account.tenant_id,
          platform:           'instagram',
          external_message_id: String(message.mid ?? ''),
          sender_id:          String(sender.id ?? ''),
          content:            String(message.text ?? '[media]'),
          message_type:       'dm',
          created_at:         new Date().toISOString(),
        }, { onConflict: 'platform,external_message_id' })
    }
  }
}
