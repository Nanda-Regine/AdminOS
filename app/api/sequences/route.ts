import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.user_metadata?.tenant_id as string

  // Fetch sequences with active enrollment counts
  const { data: sequences, error } = await supabaseAdmin
    .from('whatsapp_sequences')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Fetch enrollment counts per sequence
  const ids = (sequences ?? []).map(s => s.id)
  const enrollmentCounts: Record<string, number> = {}

  if (ids.length > 0) {
    const { data: enrollments } = await supabaseAdmin
      .from('sequence_enrollments')
      .select('sequence_id')
      .in('sequence_id', ids)
      .eq('status', 'active')

    for (const e of enrollments ?? []) {
      enrollmentCounts[e.sequence_id] = (enrollmentCounts[e.sequence_id] ?? 0) + 1
    }
  }

  const result = (sequences ?? []).map(s => ({
    ...s,
    active_enrollments: enrollmentCounts[s.id] ?? 0,
  }))

  return NextResponse.json(result)
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.user_metadata?.tenant_id as string

  const body = await request.json() as {
    name: string
    trigger_type: string
    steps: Array<{ id?: string; name: string; delay_hours: number; message: string }>
    is_active?: boolean
  }

  if (!body.name?.trim()) {
    return NextResponse.json({ error: 'name required' }, { status: 400 })
  }
  if (!body.trigger_type) {
    return NextResponse.json({ error: 'trigger_type required' }, { status: 400 })
  }
  if (!Array.isArray(body.steps) || body.steps.length === 0) {
    return NextResponse.json({ error: 'At least one step required' }, { status: 400 })
  }

  // Assign IDs to steps that don't have one
  const steps = body.steps.map((s, i) => ({
    id:          s.id ?? crypto.randomUUID(),
    name:        s.name?.trim() || `Step ${i + 1}`,
    delay_hours: s.delay_hours ?? 0,
    message:     s.message?.trim() ?? '',
  }))

  const { data, error } = await supabaseAdmin
    .from('whatsapp_sequences')
    .insert({
      tenant_id:    tenantId,
      name:         body.name.trim(),
      trigger_type: body.trigger_type,
      steps,
      is_active:    body.is_active ?? true,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
