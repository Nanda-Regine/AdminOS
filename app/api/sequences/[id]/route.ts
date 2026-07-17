import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const { id } = await params
  const tenantId = user.app_metadata?.tenant_id as string

  const body = await request.json() as {
    name?: string
    trigger_type?: string
    steps?: Array<{ id?: string; name: string; delay_hours: number; message: string }>
    is_active?: boolean
  }

  const update: Record<string, unknown> = {}
  if (body.name        !== undefined) update.name         = body.name.trim()
  if (body.trigger_type!== undefined) update.trigger_type = body.trigger_type
  if (body.is_active   !== undefined) update.is_active    = body.is_active
  if (body.steps       !== undefined) {
    update.steps = body.steps.map((s, i) => ({
      id:          s.id ?? crypto.randomUUID(),
      name:        s.name?.trim() || `Step ${i + 1}`,
      delay_hours: s.delay_hours ?? 0,
      message:     s.message?.trim() ?? '',
    }))
  }

  const { data, error } = await supabaseAdmin
    .from('whatsapp_sequences')
    .update(update)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const { id } = await params
  const tenantId = user.app_metadata?.tenant_id as string

  const { error } = await supabaseAdmin
    .from('whatsapp_sequences')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
