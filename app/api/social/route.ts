import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'
import { sanitizeForAI } from '@/lib/security/sanitize'

const replySchema = z.object({
  messageId:    z.string().uuid(),
  replyContent: z.string().min(1).max(2000),
})

// GET /api/social — inbox of all social messages across platforms
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.user_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  const url       = new URL(request.url)
  const platform  = url.searchParams.get('platform')
  const sentiment = url.searchParams.get('sentiment')
  const unreplied = url.searchParams.get('unreplied') === 'true'
  const limit     = Math.min(parseInt(url.searchParams.get('limit') ?? '50'), 200)

  let query = supabaseAdmin
    .from('social_messages')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (platform)   query = query.eq('platform', platform)
  if (sentiment)  query = query.eq('sentiment', sentiment)
  if (unreplied)  query = query.is('replied_at', null)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

// PATCH /api/social — mark message as replied
export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.user_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  let body: z.infer<typeof replySchema>
  try { body = replySchema.parse(await request.json()) } catch (e) {
    return NextResponse.json({ error: 'Invalid request', detail: e }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('social_messages')
    .update({
      replied_at:    new Date().toISOString(),
      reply_content: sanitizeForAI(body.replyContent),
    })
    .eq('id', body.messageId)
    .eq('tenant_id', tenantId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
