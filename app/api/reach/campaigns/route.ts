import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireAddon } from '@/lib/billing/gates'

export const runtime = 'nodejs'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.user_metadata?.tenant_id as string

  const { data: campaigns, error } = await supabaseAdmin
    .from('broadcast_campaigns')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(campaigns ?? [])
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  try {
    await requireAddon('reach')
  } catch {
    return NextResponse.json({ error: 'Reach add-on required' }, { status: 403 })
  }

  const tenantId = user.user_metadata?.tenant_id as string

  const body = await request.json() as {
    name: string
    message_body: string
    audience_filter?: Record<string, unknown>
    scheduled_at?: string | null
    channel?: string
  }

  if (!body.name?.trim() || !body.message_body?.trim()) {
    return NextResponse.json({ error: 'name and message_body required' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('broadcast_campaigns')
    .insert({
      tenant_id:       tenantId,
      name:            body.name.trim(),
      message_body:    body.message_body.trim(),
      audience_filter: body.audience_filter ?? {},
      channel:         body.channel ?? 'whatsapp',
      scheduled_at:    body.scheduled_at ?? null,
      status:          'draft',
      created_by:      user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
