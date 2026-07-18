import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.app_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  const { id } = await params

  // Confirm the announcement belongs to the caller's tenant before recording a
  // read receipt against a caller-supplied announcement id.
  const { data: ann } = await supabaseAdmin
    .from('announcements')
    .select('id')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle()
  if (!ann) return NextResponse.json({ error: 'Announcement not found' }, { status: 404 })

  // Upsert — safe to call multiple times
  const { error } = await supabaseAdmin
    .from('announcement_reads')
    .upsert({ announcement_id: id, user_id: user.id }, { onConflict: 'announcement_id, user_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ ok: true })
}
