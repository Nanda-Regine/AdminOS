import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireAddon } from '@/lib/billing/gates'
import { sendWhatsApp } from '@/lib/whatsapp/send'
import { Redis } from '@upstash/redis'

export const runtime = 'nodejs'
// Allow up to 5 minutes for large audience sends
export const maxDuration = 300

let _redis: Redis | null = null
function getRedis(): Redis {
  if (!_redis) {
    _redis = new Redis({
      url:   process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  }
  return _redis
}

function reachRateLimitKey(tenantId: string, phone: string): string {
  return `reach:ratelimit:${tenantId}:${phone}`
}

async function isReachRateLimited(tenantId: string, phone: string): Promise<boolean> {
  const redis = getRedis()
  const val   = await redis.get(reachRateLimitKey(tenantId, phone))
  return val !== null
}

async function setReachRateLimit(tenantId: string, phone: string): Promise<void> {
  const redis = getRedis()
  await redis.set(reachRateLimitKey(tenantId, phone), '1', { ex: 60 * 60 * 24 })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  try {
    await requireAddon('reach')
  } catch {
    return NextResponse.json({ error: 'Reach add-on required' }, { status: 402 })
  }

  const tenantId = user.app_metadata?.tenant_id as string

  let campaignId: string
  try {
    const body = await request.json() as { campaignId?: string }
    if (!body.campaignId) throw new Error('missing')
    campaignId = body.campaignId
  } catch {
    return NextResponse.json({ error: 'campaignId required' }, { status: 400 })
  }

  // Fetch campaign — must belong to tenant and be in draft/scheduled status
  const { data: campaign, error: campErr } = await supabaseAdmin
    .from('broadcast_campaigns')
    .select('*')
    .eq('id', campaignId)
    .eq('tenant_id', tenantId)
    .single()

  if (campErr || !campaign) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
  }

  if (campaign.status === 'sent' || campaign.status === 'sending') {
    return NextResponse.json({ error: `Campaign already ${campaign.status as string}` }, { status: 409 })
  }

  // Mark as sending immediately to prevent double-sends
  await supabaseAdmin
    .from('broadcast_campaigns')
    .update({ status: 'sending' })
    .eq('id', campaignId)

  // Fetch contacts filtered by audience_filter tags
  const audienceFilter = (campaign.audience_filter ?? {}) as { tags?: string[] }
  let contactsQuery = supabaseAdmin
    .from('contacts')
    .select('id, phone, name:full_name')
    .eq('tenant_id', tenantId)
    .not('phone', 'is', null)

  if (audienceFilter.tags && audienceFilter.tags.length > 0) {
    contactsQuery = contactsQuery.overlaps('tags', audienceFilter.tags)
  }

  const { data: contacts, error: contactsErr } = await contactsQuery

  if (contactsErr) {
    await supabaseAdmin
      .from('broadcast_campaigns')
      .update({ status: 'draft' })
      .eq('id', campaignId)
    return NextResponse.json({ error: contactsErr.message }, { status: 500 })
  }

  const recipients = contacts ?? []
  const message    = (campaign.message_body ?? campaign.message_template ?? '') as string

  let sentCount    = 0
  let failedCount  = 0
  const inserts: Array<Record<string, unknown>> = []

  for (const contact of recipients) {
    const phone = contact.phone as string

    // 24h rate limit — skip contacts messaged within the last day
    const limited = await isReachRateLimited(tenantId, phone).catch(() => false)
    if (limited) {
      inserts.push({
        tenant_id:  tenantId,
        campaign_id: campaignId,
        contact_id:  contact.id,
        phone,
        status:      'skipped',
      })
      continue
    }

    try {
      await sendWhatsApp({ to: phone, message })
      await setReachRateLimit(tenantId, phone)
      inserts.push({
        tenant_id:   tenantId,
        campaign_id: campaignId,
        contact_id:  contact.id,
        phone,
        status:      'sent',
        sent_at:     new Date().toISOString(),
      })
      sentCount++
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'unknown error'
      inserts.push({
        tenant_id:     tenantId,
        campaign_id:   campaignId,
        contact_id:    contact.id,
        phone,
        status:        'failed',
        error_message: errMsg.slice(0, 500),
      })
      failedCount++
    }
  }

  // Bulk-insert per-recipient send records into broadcast_recipients — the table
  // delivery/read webhooks update, so this is what backs the campaign's
  // delivered/read stats. (Was writing to a non-existent `campaign_sends`, so
  // per-recipient tracking was silently dropped.) Still non-fatal: the campaign
  // counter update below is the source of truth for sent/failed totals.
  if (inserts.length > 0) {
    await supabaseAdmin
      .from('broadcast_recipients')
      .insert(inserts)
      .then(() => {}, () => {})
  }

  // Finalize campaign
  await supabaseAdmin
    .from('broadcast_campaigns')
    .update({
      status:      'sent',
      sent_at:     new Date().toISOString(),
      sent_count:  sentCount,
      failed_count: failedCount,
    })
    .eq('id', campaignId)

  return NextResponse.json({
    campaignId,
    sent:    sentCount,
    failed:  failedCount,
    skipped: recipients.length - sentCount - failedCount,
    total:   recipients.length,
  })
}
