import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { sanitizeForAI } from '@/lib/security/sanitize'
import { checkRateLimit } from '@/lib/security/rateLimit'

// POST /api/widget/[tenantId]/message — visitor sends a message
// GET  /api/widget/[tenantId]/message?session_id=X&after=Y — poll for agent replies
//
// No authentication required — this is the public-facing widget endpoint, so it is
// rate-limited per tenant + visitor IP to prevent spam / abuse.

const MAX_MESSAGE_LENGTH = 500

export async function POST(request: Request, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params

  // Rate limit before any DB work — public endpoint, keyed by tenant + caller IP.
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const { success } = await checkRateLimit('api', `widget:${tenantId}:${ip}`)
  if (!success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  // Validate tenant
  const { data: tenant } = await supabaseAdmin
    .from('tenants')
    .select('id')
    .eq('id', tenantId)
    .single()

  if (!tenant) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let body: { session_id: string; message: string; visitor_name?: string; last_message_id?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.session_id || typeof body.session_id !== 'string') {
    return NextResponse.json({ error: 'session_id required' }, { status: 400 })
  }

  if (!body.message || typeof body.message !== 'string') {
    return NextResponse.json({ error: 'message required' }, { status: 400 })
  }

  // Sanitize message content before storing
  const safeMessage   = sanitizeForAI(body.message).slice(0, MAX_MESSAGE_LENGTH)
  const safeName      = body.visitor_name
    ? sanitizeForAI(body.visitor_name).slice(0, 80)
    : 'Website Visitor'

  const { data: inserted, error } = await supabaseAdmin
    .from('social_messages')
    .insert({
      tenant_id:          tenantId,
      platform:           'website_widget',
      external_message_id: `widget-${body.session_id}-${Date.now()}`,
      sender_id:          body.session_id,
      sender_name:        safeName,
      content:            safeMessage,
      message_type:       'widget_chat',
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: 'Failed to store message' }, { status: 500 })

  return NextResponse.json({ ok: true, message_id: inserted.id })
}

export async function GET(request: Request, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params

  const url       = new URL(request.url)
  const sessionId = url.searchParams.get('session_id')
  const after     = url.searchParams.get('after')

  if (!sessionId) return NextResponse.json({ error: 'session_id required' }, { status: 400 })

  // Validate tenant
  const { data: tenant } = await supabaseAdmin
    .from('tenants')
    .select('id')
    .eq('id', tenantId)
    .single()

  if (!tenant) return NextResponse.json({ replies: [] })

  // Find agent replies to this session's messages
  // Agent replies are stored as social_messages with reply_content set
  // and linked to the session via metadata
  let query = supabaseAdmin
    .from('social_messages')
    .select('id, content, created_at, reply_content, replied_at')
    .eq('tenant_id', tenantId)
    .eq('sender_id', sessionId)
    .not('reply_content', 'is', null)

  if (after) {
    query = query.gt('id', after)
  }

  const { data: messages } = await query.order('created_at', { ascending: true }).limit(20)

  const replies = (messages ?? []).map(m => ({
    id:          m.id,
    content:     m.reply_content,
    created_at:  m.replied_at,
  }))

  return NextResponse.json({ replies })
}
