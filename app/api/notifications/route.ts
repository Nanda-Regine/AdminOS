import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

// GET  /api/notifications        → recent notifications + unread count (tenant-scoped)
// POST /api/notifications  {id}  → mark one read · {all:true} → mark all read
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })
  const tenantId = user.app_metadata?.tenant_id as string
  if (!tenantId) return NextResponse.json({ items: [], unread: 0 })

  // Tenant-level (user_id null) OR addressed to this user.
  const { data } = await supabaseAdmin
    .from('notifications')
    .select('id, type, title, body, read, action_url, created_at')
    .eq('tenant_id', tenantId)
    .or(`user_id.is.null,user_id.eq.${user.id}`)
    .order('created_at', { ascending: false })
    .limit(20)

  const items = data ?? []
  const unread = items.filter(n => !n.read).length
  return NextResponse.json({ items, unread })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })
  const tenantId = user.app_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  const body = await request.json().catch(() => ({})) as { id?: string; all?: boolean }
  let q = supabaseAdmin.from('notifications').update({ read: true }).eq('tenant_id', tenantId)
  if (body.all) {
    q = q.eq('read', false)
  } else if (body.id) {
    q = q.eq('id', body.id)
  } else {
    return NextResponse.json({ error: 'id or all required' }, { status: 400 })
  }
  const { error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
